---
layout: default
title: Artwork
---

# artwork and projects

<ul>
  {% for project in site.artwork %}
    <li>
      <a href="{{ project.url }}">{{ project.title }}</a> — {{ project.year }}
    </li>
  {% endfor %}
</ul>