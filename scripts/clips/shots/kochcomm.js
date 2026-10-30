module.exports = {
  site: 'kochcomm', url: 'https://www.kochcomm.com/',
  scroll: [
    { name: 'full', viewport: 'FULL', stops: [0, 0.193, 0.335, 0.502, 0.682, 0.824, 1], timing: { lead: 4, move: 1.5, hold: 1.1 } },
    { name: 'phone', viewport: 'PHONE', stops: [0, 0.18, 0.36, 0.54, 0.72, 1], timing: { lead: 1.6, move: 1.3, hold: 0.9, step: 680 } },
    { name: 'history', viewport: 'FULL', url: 'https://www.kochcomm.com/history/', stops: [0, 0.2, 0.4, 0.6, 0.8, 1], timing: { lead: 2.5, move: 1.5, hold: 1.1 } },
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
    {
      // The work archive by industry (Nonprofit), then by service (Brands), then everything again.
      name: 'archive', url: 'https://www.kochcomm.com/all-work/', height: 1000, pin: { sel: '.e-n-tabs', top: 70 }, seconds: 12.0,
      late: ['sel:|button.e-filter-item[data-filter="nonprofit"]', 'sel:|button.e-filter-item[data-filter="brands"]', 'sel:|button.e-filter-item[data-filter="__all"]'],
      pointer: [
        [0, 0.4, 'rest:0.88,0.05', 'rest:0.88,0.05'],
        [0.4, 1.0, 'rest:0.88,0.05', 'sel:|button.e-n-tab-title@Industries'], [1.0, 1.6, 'sel:|button.e-n-tab-title@Industries', 'sel:|button.e-n-tab-title@Industries'],
        [1.6, 2.3, 'sel:|button.e-n-tab-title@Industries', 'sel:|button.e-filter-item[data-filter="nonprofit"]'], [2.3, 4.6, 'sel:|button.e-filter-item[data-filter="nonprofit"]', 'sel:|button.e-filter-item[data-filter="nonprofit"]'],
        [4.6, 5.2, 'sel:|button.e-filter-item[data-filter="nonprofit"]', 'sel:|button.e-n-tab-title@Services'], [5.2, 5.8, 'sel:|button.e-n-tab-title@Services', 'sel:|button.e-n-tab-title@Services'],
        [5.8, 6.5, 'sel:|button.e-n-tab-title@Services', 'sel:|button.e-filter-item[data-filter="brands"]'], [6.5, 8.8, 'sel:|button.e-filter-item[data-filter="brands"]', 'sel:|button.e-filter-item[data-filter="brands"]'],
        [8.8, 9.4, 'sel:|button.e-filter-item[data-filter="brands"]', 'sel:|button.e-filter-item[data-filter="__all"]'], [9.4, 10.4, 'sel:|button.e-filter-item[data-filter="__all"]', 'sel:|button.e-filter-item[data-filter="__all"]'],
        [10.4, 11.0, 'sel:|button.e-filter-item[data-filter="__all"]', 'rest:0.88,0.05'], [11.0, 12.0, 'rest:0.88,0.05', 'rest:0.88,0.05'],
      ],
      clicks: [1.1, 2.4, 5.3, 6.6, 9.5],
    },
  ],
};
