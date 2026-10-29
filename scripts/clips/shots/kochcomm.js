module.exports = {
  site: 'kochcomm', url: 'https://www.kochcomm.com/',
  scroll: [
    { name: 'full', viewport: 'FULL', stops: [0, 0.193, 0.335, 0.502, 0.682, 0.824, 1], timing: { lead: 4, move: 1.5, hold: 1.1 } },
    { name: 'phone', viewport: 'PHONE', stops: [0, 0.18, 0.36, 0.54, 0.72, 1], timing: { lead: 1.6, move: 1.3, hold: 0.9, step: 680 } },
    { name: 'phone-work', viewport: 'PHONE', url: 'https://www.kochcomm.com/all-work/', stops: [0, 0.18, 0.36, 0.54, 0.72, 1], timing: { lead: 1.6, move: 1.3, hold: 0.9, step: 680 } },
  ],
  details: [
    {
      name: 'services', pin: { text: 'clients grow', top: 240 }, seconds: 5.6,
      pointer: [
        [0, 0.4, 'rest:0.5,0.9', 'rest:0.5,0.9'],
        [0.4, 1.0, 'rest:0.5,0.9', 'in:clients grow|Marketing Strategy'], [1.0, 1.8, 'in:clients grow|Marketing Strategy', 'in:clients grow|Marketing Strategy'],
        [1.8, 2.3, 'in:clients grow|Marketing Strategy', 'in:clients grow|Public Relations'], [2.3, 3.1, 'in:clients grow|Public Relations', 'in:clients grow|Public Relations'],
        [3.1, 3.6, 'in:clients grow|Public Relations', 'in:clients grow|Crisis Communications'], [3.6, 4.4, 'in:clients grow|Crisis Communications', 'in:clients grow|Crisis Communications'],
        [4.4, 5.3, 'in:clients grow|Crisis Communications', 'rest:0.5,0.9'], [5.3, 5.6, 'rest:0.5,0.9', 'rest:0.5,0.9'],
      ],
    },
    {
      name: 'work', pin: { text: 'Launching the Comets', top: 590 }, seconds: 6.6,
      pointer: [
        [0, 0.4, 'rest:0.5,0.9', 'rest:0.5,0.9'],
        [0.4, 1.0, 'rest:0.5,0.9', 'sel:Launching the Comets|[class*="swiper-button-next"]'], [1.0, 3.0, 'sel:Launching the Comets|[class*="swiper-button-next"]', 'sel:Launching the Comets|[class*="swiper-button-next"]'],
        [3.0, 3.9, 'sel:Launching the Comets|[class*="swiper-button-next"]', 'sel:Launching the Comets|[class*="swiper-button-prev"]'], [3.9, 5.8, 'sel:Launching the Comets|[class*="swiper-button-prev"]', 'sel:Launching the Comets|[class*="swiper-button-prev"]'],
        [5.8, 6.4, 'sel:Launching the Comets|[class*="swiper-button-prev"]', 'rest:0.5,0.9'], [6.4, 6.6, 'rest:0.5,0.9', 'rest:0.5,0.9'],
      ],
      clicks: [1.1, 2.1, 4.0, 5.0],
    },
  ],
};
