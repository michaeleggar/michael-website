module.exports = {
  site: 'goldenmesa', url: 'https://goldenmesa.com/', slow: 16,
  scroll: [
    { name: 'full', viewport: 'FULL', stops: [0, 0.203, 0.397, 0.578, 0.763, 1] },
    { name: 'phone', viewport: 'PHONE', stops: [0, 0.18, 0.36, 0.54, 0.72, 1], timing: { move: 1.1, hold: 0.8 } },
  ],
  details: [
    {
      name: 'promos', pin: { text: 'See All Promotions', top: 150 }, seconds: 6.6,
      pointer: [
        [0, 0.4, 'rest:0.62,0.86', 'rest:0.62,0.86'],
        [0.4, 1.0, 'rest:0.62,0.86', 'sel:See All Promotions|[class*="swiper-button-next"]'], [1.0, 3.0, 'sel:See All Promotions|[class*="swiper-button-next"]', 'sel:See All Promotions|[class*="swiper-button-next"]'],
        [3.0, 3.8, 'sel:See All Promotions|[class*="swiper-button-next"]', 'sel:See All Promotions|[class*="swiper-button-prev"]'], [3.8, 5.8, 'sel:See All Promotions|[class*="swiper-button-prev"]', 'sel:See All Promotions|[class*="swiper-button-prev"]'],
        [5.8, 6.4, 'sel:See All Promotions|[class*="swiper-button-prev"]', 'rest:0.62,0.86'], [6.4, 6.6, 'rest:0.62,0.86', 'rest:0.62,0.86'],
      ],
      clicks: [1.1, 2.1, 3.9, 4.9],
    },
    {
      name: 'menu', keepHeader: true, pin: { text: 'Players Club', top: 102 }, seconds: 7.4,
      pointer: [
        [0, 0.4, 'rest:0.5,0.62', 'rest:0.5,0.62'],
        [0.4, 1.0, 'rest:0.5,0.62', 'in:Players Club|Play'], [1.0, 2.4, 'in:Players Club|Play', 'in:Players Club|Play'],
        [2.4, 2.8, 'in:Players Club|Play', 'in:Players Club|Eat'], [2.8, 4.2, 'in:Players Club|Eat', 'in:Players Club|Eat'],
        [4.2, 4.6, 'in:Players Club|Eat', 'in:Players Club|Stay'], [4.6, 6.2, 'in:Players Club|Stay', 'in:Players Club|Stay'],
        [6.2, 7.1, 'in:Players Club|Stay', 'rest:0.5,0.62'], [7.1, 7.4, 'rest:0.5,0.62', 'rest:0.5,0.62'],
      ],
      clicks: [1.1, 2.9, 4.7, 6.0],
      // Open each menu once first, so its photographs are loaded before recording.
      reset: ['in:Players Club|Play', 'in:Players Club|Eat', 'in:Players Club|Stay', 'in:Players Club|Stay'],
    },
  ],
};
