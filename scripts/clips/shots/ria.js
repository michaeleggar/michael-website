module.exports = {
  site: 'ria', url: 'https://theretirementpath.com/',
  scroll: [
    { name: 'full', viewport: 'FULL', stops: [0, 0.37, 0.546, 0.756, 1], timing: { lead: 2.5, move: 1.5, hold: 1.1 } },
    { name: 'phone', viewport: 'PHONE', stops: [0, 0.18, 0.36, 0.54, 0.72, 1], timing: { lead: 1.6, move: 1.3, hold: 0.9, step: 680 } },
    { name: 'phone-library', viewport: 'PHONE', url: 'https://theretirementpath.com/resources/', stops: [0, 0.18, 0.36, 0.54, 0.72, 1], timing: { lead: 1.6, move: 1.3, hold: 0.9, step: 680 } },
  ],
  details: [
    {
      name: 'services', pin: { text: 'Our Services', top: 125 }, seconds: 5.6,
      pointer: [
        [0, 0.4, 'rest:0.5,0.95', 'rest:0.5,0.95'],
        [0.4, 1.0, 'rest:0.5,0.95', 'in:Our Services|Retirement Planning'], [1.0, 1.8, 'in:Our Services|Retirement Planning', 'in:Our Services|Retirement Planning'],
        [1.8, 2.3, 'in:Our Services|Retirement Planning', 'in:Our Services|Investment Management'], [2.3, 3.1, 'in:Our Services|Investment Management', 'in:Our Services|Investment Management'],
        [3.1, 3.6, 'in:Our Services|Investment Management', 'in:Our Services|Tax Strategies'], [3.6, 4.4, 'in:Our Services|Tax Strategies', 'in:Our Services|Tax Strategies'],
        [4.4, 5.3, 'in:Our Services|Tax Strategies', 'rest:0.5,0.95'], [5.3, 5.6, 'rest:0.5,0.95', 'rest:0.5,0.95'],
      ],
    },
    {
      name: 'library', pin: { text: 'Navigating your', top: 130 }, seconds: 6.4,
      pointer: [
        [0, 0.4, 'rest:0.5,0.97', 'rest:0.5,0.97'],
        [0.4, 1.0, 'rest:0.5,0.97', 'text:10 Tax Savings Secrets'], [1.0, 1.7, 'text:10 Tax Savings Secrets', 'text:10 Tax Savings Secrets'],
        [1.7, 2.2, 'text:10 Tax Savings Secrets', 'text:Road Map to Retirement'], [2.2, 2.9, 'text:Road Map to Retirement', 'text:Road Map to Retirement'],
        [2.9, 3.4, 'text:Road Map to Retirement', 'text:TSP vs The All-Weather Retirement Portfolio'], [3.4, 4.1, 'text:TSP vs The All-Weather Retirement Portfolio', 'text:TSP vs The All-Weather Retirement Portfolio'],
        [4.1, 4.6, 'text:TSP vs The All-Weather Retirement Portfolio', 'text:Qualified Charitable Distribution'], [4.6, 5.3, 'text:Qualified Charitable Distribution', 'text:Qualified Charitable Distribution'],
        [5.3, 6.1, 'text:Qualified Charitable Distribution', 'rest:0.5,0.97'], [6.1, 6.4, 'rest:0.5,0.97', 'rest:0.5,0.97'],
      ],
    },
  ],
};
