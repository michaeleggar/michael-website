module.exports = {
  site: 'goldenmesa', url: 'https://goldenmesa.com/', slow: 16,
  scroll: [
    { name: 'full', viewport: 'FULL', stops: [0, 0.203, 0.397, 0.578, 0.763, 1], timing: { lead: 5, move: 1.6, hold: 1.3 } },
    { name: 'phone', viewport: 'PHONE', stops: [0, 0.18, 0.36, 0.54, 0.72, 1], timing: { lead: 2, move: 1.5, hold: 1.1, step: 640 } },
    { name: 'phone-promos', viewport: 'PHONE', url: 'https://goldenmesa.com/promotions/', stops: [0, 0.18, 0.36, 0.54, 0.72, 1], timing: { lead: 2, move: 1.5, hold: 1.1, step: 640 } },
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
    {
      name: 'filter', url: 'https://goldenmesa.com/promotions/', height: 1100, pin: { text: 'Category', top: 110 }, seconds: 8.4,
      pointer: [
        [0, 0.4, 'rest:0.58,0.6', 'rest:0.58,0.6'],
        [0.4, 1.0, 'rest:0.58,0.6', 'sel:|.gm-promotions-filter__type-control@Event'], [1.0, 2.8, 'sel:|.gm-promotions-filter__type-control@Event', 'sel:|.gm-promotions-filter__type-control@Event'],
        [2.8, 3.2, 'sel:|.gm-promotions-filter__type-control@Event', 'sel:|.gm-promotions-filter__type-control@Event'],
        [3.2, 3.8, 'sel:|.gm-promotions-filter__type-control@Event', 'sel:|.gm-promotions-filter__type-control@Promotion'], [3.8, 6.6, 'sel:|.gm-promotions-filter__type-control@Promotion', 'sel:|.gm-promotions-filter__type-control@Promotion'],
        [6.6, 7.6, 'sel:|.gm-promotions-filter__type-control@Promotion', 'rest:0.58,0.6'], [7.6, 8.4, 'rest:0.58,0.6', 'rest:0.58,0.6'],
      ],
      clicks: [1.1, 2.9, 3.9, 5.7],
    },
    {
      name: 'rooms', url: 'https://goldenmesa.com/hotel/', height: 1000, pin: { text: 'Double Queen Room', top: 560 }, seconds: 9.7,
      pointer: [
        [0, 0.4, 'rest:0.5,0.9', 'rest:0.5,0.9'],
        [0.4, 1.0, 'rest:0.5,0.9', 'sel:Double Queen Room|.gm-room-gallery__arrow--next'],
        [1.0, 1.8, 'sel:Double Queen Room|.gm-room-gallery__arrow--next', 'sel:Double Queen Room|.gm-room-gallery__arrow--next'],
        [1.8, 2.2, 'sel:Double Queen Room|.gm-room-gallery__arrow--next', 'sel:Standard King Room|.gm-room-gallery__arrow--next'],
        [2.2, 3.0, 'sel:Standard King Room|.gm-room-gallery__arrow--next', 'sel:Standard King Room|.gm-room-gallery__arrow--next'],
        [3.0, 3.5, 'sel:Standard King Room|.gm-room-gallery__arrow--next', 'sel:King Deluxe Room|.gm-room-gallery__arrow--next'],
        [3.5, 4.3, 'sel:King Deluxe Room|.gm-room-gallery__arrow--next', 'sel:King Deluxe Room|.gm-room-gallery__arrow--next'],
        [4.3, 5.2, 'sel:King Deluxe Room|.gm-room-gallery__arrow--next', 'sel:Double Queen Room|.gm-room-gallery__arrow--prev'],
        [5.2, 6.0, 'sel:Double Queen Room|.gm-room-gallery__arrow--prev', 'sel:Double Queen Room|.gm-room-gallery__arrow--prev'],
        [6.0, 6.5, 'sel:Double Queen Room|.gm-room-gallery__arrow--prev', 'sel:Standard King Room|.gm-room-gallery__arrow--prev'],
        [6.5, 7.2, 'sel:Standard King Room|.gm-room-gallery__arrow--prev', 'sel:Standard King Room|.gm-room-gallery__arrow--prev'],
        [7.2, 7.7, 'sel:Standard King Room|.gm-room-gallery__arrow--prev', 'sel:King Deluxe Room|.gm-room-gallery__arrow--prev'],
        [7.7, 8.5, 'sel:King Deluxe Room|.gm-room-gallery__arrow--prev', 'sel:King Deluxe Room|.gm-room-gallery__arrow--prev'],
        [8.5, 9.3, 'sel:King Deluxe Room|.gm-room-gallery__arrow--prev', 'rest:0.5,0.9'],
        [9.3, 9.7, 'rest:0.5,0.9', 'rest:0.5,0.9'],
      ],
      clicks: [1.1, 2.4, 3.6, 5.3, 6.5, 7.8],
    },
  ],
};
