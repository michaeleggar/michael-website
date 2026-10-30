// The original chat app on a stage: the crew panel (cropped to the part in use) beside the actor's screen.
const opening = [
  ['user_friend', 'anyone else up?'],
  ['user_ichigo99', 'always lol'],
  ['user_jen_brian', "same. scan results tomorrow so sleep isn't happening"],
  ['user_friend', 'you got this. wating is the worst part'],
  ['user_main', "hey everyone, sorry I've been quiet"],
];
const CTL = { id: 'ctl', src: '/control.html', size: [1440, 1000], radius: 8 };
// The screen page pads its app card by 16px; crop to the card.
const scr = (w, h, scale) => ({ id: 'scr', src: '/screen.html', size: [w + 32, h + 32], region: [16, 16, w, h], scale, radius: 6 * scale });
const seg = (...pts) => pts; // [start, end, from, to]
const R = 'rest:0.5,0.97';
module.exports = [
  {
    // Typing, presence, and a DM, from the roster.
    name: 'roster', opening, seconds: 12.4,
    windows: [{ ...CTL, region: [0, 65, 340, 630], scale: 0.9 }, scr(968, 630, 0.9)],
    pointer: [
      seg(0, 0.4, R, R),
      seg(0.4, 1.0, R, 'ctl:label@Typing@1'), seg(1.0, 3.0, 'ctl:label@Typing@1', 'ctl:label@Typing@1'),
      seg(3.0, 3.6, 'ctl:label@Typing@1', 'ctl:label@Online@2'), seg(3.6, 5.6, 'ctl:label@Online@2', 'ctl:label@Online@2'),
      seg(5.6, 6.2, 'ctl:label@Online@2', 'ctl:button@Switch to DM@2'), seg(6.2, 8.4, 'ctl:button@Switch to DM@2', 'ctl:button@Switch to DM@2'),
      seg(8.4, 9.3, 'ctl:button@Switch to DM@2', 'scr:button@Back to group'), seg(9.3, 10.6, 'scr:button@Back to group', 'scr:button@Back to group'),
      seg(10.6, 11.4, 'scr:button@Back to group', R), seg(11.4, 12.4, R, R),
    ],
    late: ['scr:button@Back to group'],
    events: [{ t: 1.1, click: 'ctl:label@Typing@1' }, { t: 2.9, click: 'ctl:label@Typing@1' }, { t: 3.7, click: 'ctl:label@Online@2' }, { t: 5.5, click: 'ctl:label@Online@2' }, { t: 6.3, click: 'ctl:button@Switch to DM@2' }, { t: 9.4, click: 'scr:button@Back to group' }],
  },
  {
    // A line sent as jen_brian with a two-second typing delay.
    name: 'send', opening, seconds: 10.6,
    windows: [{ ...CTL, region: [340, 65, 717, 534], scale: 0.9 }, scr(700, 534, 0.9)],
    pointer: [
      seg(0, 0.4, R, R),
      seg(0.4, 1.0, R, 'ctl:#sendAs'), seg(1.0, 1.6, 'ctl:#sendAs', 'ctl:#sendAs'),
      seg(1.6, 2.1, 'ctl:#sendAs', 'ctl:#templateDelayInput'), seg(2.1, 2.7, 'ctl:#templateDelayInput', 'ctl:#templateDelayInput'),
      seg(2.7, 3.2, 'ctl:#templateDelayInput', 'ctl:#composerInput'), seg(3.2, 5.0, 'ctl:#composerInput', 'ctl:#composerInput'),
      seg(5.0, 5.6, 'ctl:#composerInput', 'ctl:#sendMessageBtn'), seg(5.6, 9.0, 'ctl:#sendMessageBtn', 'ctl:#sendMessageBtn'),
      seg(9.0, 9.8, 'ctl:#sendMessageBtn', R), seg(9.8, 10.6, R, R),
    ],
    events: [
      { t: 1.1, set: 'ctl:#sendAs', arg: 'user_jen_brian' },
      { t: 2.2, set: 'ctl:#templateDelayInput', arg: '' }, { t: 2.35, type: 'ctl:#templateDelayInput', arg: { text: '2', delay: 0 } },
      { t: 3.3, type: 'ctl:#composerInput', arg: { text: 'how did the appointment go?', delay: 50 } },
      { t: 5.7, click: 'ctl:#sendMessageBtn' },
    ],
  },
  {
    // Two saved lines sent in turn, each after its own typing delay.
    name: 'saved', opening, seconds: 11.4,
    storage: { chat_app_legacy_templates: [
      { id: 'tpl_1', userId: 'user_jen_brian', text: 'how did the appointment go?', delayMs: 2500, updatedAt: 1 },
      { id: 'tpl_2', userId: 'user_ichigo99', text: "you don't have to say if you don't want to", delayMs: 1800, updatedAt: 2 },
    ] },
    column: true, windows: [{ ...CTL, region: [340, 583, 1076, 238], scale: 0.9 }, scr(1076, 470, 0.9)],
    pointer: [
      seg(0, 0.4, R, R),
      seg(0.4, 1.0, R, 'ctl:#templateList button@Send@0'), seg(1.0, 5.0, 'ctl:#templateList button@Send@0', 'ctl:#templateList button@Send@0'),
      seg(5.0, 5.6, 'ctl:#templateList button@Send@0', 'ctl:#templateList button@Send@1'), seg(5.6, 9.6, 'ctl:#templateList button@Send@1', 'ctl:#templateList button@Send@1'),
      seg(9.6, 10.4, 'ctl:#templateList button@Send@1', R), seg(10.4, 11.4, R, R),
    ],
    events: [{ t: 1.1, click: 'ctl:#templateList button@Send@0' }, { t: 5.7, click: 'ctl:#templateList button@Send@1' }],
  },
  {
    // A video request from BillyTheKid, accepted on the actor's screen and ended by the crew.
    name: 'video', opening, seconds: 12.0,
    windows: [{ ...CTL, region: [1041, 65, 375, 534], scale: 0.9 }, scr(900, 680, 0.9)],
    pointer: [
      seg(0, 0.4, R, R),
      seg(0.4, 1.0, R, 'ctl:#videoRequester'), seg(1.0, 1.6, 'ctl:#videoRequester', 'ctl:#videoRequester'),
      seg(1.6, 2.1, 'ctl:#videoRequester', 'ctl:#videoRequestBtn'), seg(2.1, 3.4, 'ctl:#videoRequestBtn', 'ctl:#videoRequestBtn'),
      seg(3.4, 4.2, 'ctl:#videoRequestBtn', 'scr:[data-action="videoAccept"]'), seg(4.2, 7.6, 'scr:[data-action="videoAccept"]', 'scr:[data-action="videoAccept"]'),
      seg(7.6, 8.4, 'scr:[data-action="videoAccept"]', 'ctl:#videoEndBtn'), seg(8.4, 10.6, 'ctl:#videoEndBtn', 'ctl:#videoEndBtn'),
      seg(10.6, 11.2, 'ctl:#videoEndBtn', R), seg(11.2, 12.0, R, R),
    ],
    late: ['scr:[data-action="videoAccept"]'],
    events: [
      { t: 1.1, set: 'ctl:#videoRequester', arg: 'user_friend' },
      { t: 2.2, click: 'ctl:#videoRequestBtn' }, { t: 4.3, click: 'scr:[data-action="videoAccept"]' }, { t: 8.5, click: 'ctl:#videoEndBtn' },
    ],
  },
  {
    // The actor's screen: a typo fixed from the right-click menu, then a message moved up.
    name: 'edit', opening, seconds: 13.0, margin: 40,
    windows: [scr(1168, 700, 1)],
    pointer: [
      seg(0, 0.4, R, R),
      seg(0.4, 1.0, R, 'scr:.message@wating'), seg(1.0, 1.5, 'scr:.message@wating', 'scr:.message@wating'),
      seg(1.5, 1.9, 'scr:.message@wating', 'scr:[data-menu-action="edit"]'), seg(1.9, 2.8, 'scr:[data-menu-action="edit"]', 'scr:[data-menu-action="edit"]'),
      seg(2.8, 3.3, 'scr:[data-menu-action="edit"]', 'scr:#messageEditorInput'), seg(3.3, 5.4, 'scr:#messageEditorInput', 'scr:#messageEditorInput'),
      seg(5.4, 5.9, 'scr:#messageEditorInput', 'scr:#messageEditorSave'), seg(5.9, 6.8, 'scr:#messageEditorSave', 'scr:#messageEditorSave'),
      seg(6.8, 7.5, 'scr:#messageEditorSave', 'scr:.message@quiet'), seg(7.5, 8.1, 'scr:.message@quiet', 'scr:.message@quiet'),
      seg(8.1, 8.5, 'scr:.message@quiet', 'scr:[data-menu-action="moveUp"]'), seg(8.5, 9.6, 'scr:[data-menu-action="moveUp"]', 'scr:[data-menu-action="moveUp"]'),
      seg(9.6, 10.4, 'scr:[data-menu-action="moveUp"]', R), seg(10.4, 13.0, R, R),
    ],
    late: ['scr:[data-menu-action="edit"]', 'scr:#messageEditorInput', 'scr:#messageEditorSave', 'scr:[data-menu-action="moveUp"]', 'scr:.message@quiet'],
    events: [
      { t: 1.1, right: 'scr:.message@wating' }, { t: 2.5, click: 'scr:[data-menu-action="edit"]' },
      { t: 3.9, type: 'scr:#messageEditorInput', arg: { text: 'i', delay: 0, at: 16 } },
      { t: 6.0, click: 'scr:#messageEditorSave' }, { t: 7.6, right: 'scr:.message@quiet' }, { t: 8.7, click: 'scr:[data-menu-action="moveUp"]' },
    ],
  },
];
