// Refraction and specular lighting share a convex bevel and its surface normals.
// Inspired by https://kube.io/blog/liquid-glass-css-svg/; this is a simplified
// single-interface lens model, not a reproduction of Apple's renderer.
export function createNavigationGlass(nav) {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;pointer-events:none;overflow:hidden";
  const filter = document.createElementNS(svgNamespace, "filter");
  filter.id = "navigation-glass-lens";
  filter.setAttribute("x", "0%");
  filter.setAttribute("y", "0%");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  filter.setAttribute("color-interpolation-filters", "sRGB");
  svg.append(filter);

  function primitive(name, attributes) {
    const element = document.createElementNS(svgNamespace, name);
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }
    filter.append(element);
    return element;
  }

  const image = primitive("feImage", {
    x: "0%", y: "0%", width: "100%", height: "100%",
    preserveAspectRatio: "none", result: "lens",
  });
  const channels = ["red", "green", "blue"].map((channel, index) => {
    const displacement = primitive("feDisplacementMap", {
      in: "SourceGraphic", in2: "lens", scale: "0",
      xChannelSelector: "R", yChannelSelector: "G", result: `${channel}-bent`,
    });
    const matrix = [
      index === 0 ? "1 0 0 0 0" : "0 0 0 0 0",
      index === 1 ? "0 1 0 0 0" : "0 0 0 0 0",
      index === 2 ? "0 0 1 0 0" : "0 0 0 0 0",
      "0 0 0 1 0",
    ].join(" ");
    primitive("feColorMatrix", { in: `${channel}-bent`, type: "matrix", values: matrix, result: channel });
    return displacement;
  });
  primitive("feBlend", { in: "red", in2: "green", mode: "screen", result: "red-green" });
  primitive("feBlend", { in: "red-green", in2: "blue", mode: "screen" });
  document.body.append(svg);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const lightCanvas = document.createElement("canvas");
  const lightContext = lightCanvas.getContext("2d");
  let optics = { refraction: 0, chromaticAberration: 0, edgeWidth: 8 };
  let bevel = { profile: "squircle", depth: 6, highlight: 22, shade: 12, lightAngle: 135, lightSpread: 35 };
  let shape = { radius: 16, curve: 1.6 };
  let mapKey = "";
  let maximumDisplacement = 0;
  let frame = 0;

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const nativeCorners = CSS.supports("corner-shape", "superellipse(2)");
  // Parsing url() is insufficient: Safari/Firefox may accept the syntax
  // without compositing an SVG backdrop. Keep ordinary blur in those engines.
  const supported = /(?:Chrome|Chromium|Edg)\//.test(navigator.userAgent)
    && CSS.supports("backdrop-filter", `url(#${filter.id})`);

  function updateScales() {
    // Maps point inward, so positive scales produce a convex magnifying edge.
    const scale = maximumDisplacement * 2 * optics.refraction / 24;
    const dispersion = optics.chromaticAberration * 0.06;
    channels[0].setAttribute("scale", scale * (1 - dispersion));
    channels[1].setAttribute("scale", scale);
    channels[2].setAttribute("scale", scale * (1 + dispersion));
  }

  function updateMap() {
    const bounds = nav.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    const radius = Math.min(shape.radius, width / 2, height / 2);
    const exponent = nativeCorners ? 2 ** shape.curve : 2;
    const edgeWidth = Math.min(optics.edgeWidth, width / 2, height / 2);
    const key = [width, height, resolution, radius, exponent, edgeWidth, ...Object.values(bevel)].join(":");
    if (key === mapKey) return;
    mapKey = key;
    canvas.width = lightCanvas.width = Math.ceil(width * resolution);
    canvas.height = lightCanvas.height = Math.ceil(height * resolution);
    const pixels = context.createImageData(canvas.width, canvas.height);
    const lights = lightContext.createImageData(canvas.width, canvas.height);

    // Trace one cross-section, then reuse it around the entire outline.
    // The profile rises from the edge into a flat face with a smooth tangent.
    const power = { rounded: 2, squircle: 4, soft: 6 }[bevel.profile] ?? 4;
    const samples = 512;
    const profile = [];
    maximumDisplacement = 0;
    for (let i = 0; i <= samples; i++) {
      const t = clamp(i / samples, 0.0001, 1);
      const remainder = 1 - (1 - t) ** power;
      const heightAtEdge = remainder ** (1 / power);
      const slope = bevel.depth / edgeWidth * (1 - t) ** (power - 1)
        * remainder ** (1 / power - 1);
      const incident = Math.atan(slope);
      const refracted = Math.asin(Math.sin(incident) / 1.5);
      const normalZ = Math.cos(incident);
      const normalSide = Math.sin(incident);
      // Schlick's approximation fades transmission at grazing angles.
      const fresnel = 0.04 + 0.96 * (1 - normalZ) ** 5;
      const displacement = Math.tan(incident - refracted)
        * bevel.depth * heightAtEdge * (1 - fresnel);
      maximumDisplacement = Math.max(maximumDisplacement, displacement);
      profile.push({ displacement, normalZ, normalSide, fresnel });
    }

    const angle = (bevel.lightAngle - 90) * Math.PI / 180;
    const lightX = -Math.cos(angle);
    const lightY = -Math.sin(angle);
    const halfSide = Math.sqrt(0.2);
    const halfZ = Math.sqrt(0.8);
    const shininess = 8 + (80 - bevel.lightSpread) * 1.2;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const px = (x + 0.5) / canvas.width * width - width / 2;
        const py = (y + 0.5) / canvas.height * height - height / 2;
        const qx = Math.abs(px) - (width / 2 - radius);
        const qy = Math.abs(py) - (height / 2 - radius);
        let distance;
        let nx;
        let ny;
        if (qx > 0 && qy > 0) {
          const norm = (qx ** exponent + qy ** exponent) ** (1 / exponent);
          nx = (qx / norm) ** (exponent - 1);
          ny = (qy / norm) ** (exponent - 1);
          const length = Math.hypot(nx, ny);
          distance = (norm - radius) / length;
          nx /= length;
          ny /= length;
        } else {
          distance = Math.max(qx, qy) - radius;
          nx = qx > qy ? 1 : 0;
          ny = qx > qy ? 0 : 1;
        }
        nx *= Math.sign(px);
        ny *= Math.sign(py);
        const t = clamp(-distance / edgeWidth);
        const sample = profile[Math.round(t * samples)];
        const coverage = clamp(0.5 - distance * resolution);
        const bend = sample.displacement / (maximumDisplacement || 1) * coverage;
        const offset = (y * canvas.width + x) * 4;
        pixels.data[offset] = Math.round(127.5 - nx * bend * 127.5);
        pixels.data[offset + 1] = Math.round(127.5 - ny * bend * 127.5);
        pixels.data[offset + 2] = 128;
        pixels.data[offset + 3] = 255;

        // The very same surface normal determines the reflection. A small
        // opposing fill keeps the far edge legible without outlining the face.
        const facing = nx * lightX + ny * lightY;
        const primary = clamp(sample.normalSide * facing * halfSide + sample.normalZ * halfZ) ** shininess;
        const reflected = clamp(-sample.normalSide * facing * halfSide + sample.normalZ * halfZ) ** shininess;
        const specular = (primary + reflected * 0.2) * sample.normalSide * 2.2
          + sample.fresnel * sample.normalSide * (0.15 + clamp(facing) ** 2) * 0.35;
        const shade = clamp(-facing) * sample.normalSide ** 2 * (1 - t);
        const illumination = (specular * bevel.highlight / 100 - shade * bevel.shade / 100) * coverage;
        const color = illumination >= 0 ? 255 : 0;
        lights.data[offset] = lights.data[offset + 1] = lights.data[offset + 2] = color;
        lights.data[offset + 3] = Math.round(clamp(Math.abs(illumination)) * 255);
      }
    }
    context.putImageData(pixels, 0, 0);
    image.setAttribute("href", canvas.toDataURL());
    lightContext.putImageData(lights, 0, 0);
    nav.style.setProperty("--nav-bevel-light", `url("${lightCanvas.toDataURL()}")`);
  }

  function scheduleUpdate() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      updateMap();
      updateScales();
    });
  }
  const resizeObserver = new ResizeObserver(scheduleUpdate);
  resizeObserver.observe(nav);
  window.addEventListener("resize", scheduleUpdate);

  return {
    url: `url(#${filter.id})`,
    supported,
    setOptics(values, bevelValues) {
      optics = values;
      bevel = bevelValues;
      scheduleUpdate();
    },
    setShape(values) {
      shape = { radius: values.outerRadius, curve: values.curve };
      scheduleUpdate();
    },
    destroy() {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      cancelAnimationFrame(frame);
      nav.style.removeProperty("--nav-bevel-light");
      svg.remove();
    },
  };
}
