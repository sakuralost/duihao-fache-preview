(function (root) {
  var NS = root.JellyShop || (root.JellyShop = {});

  // Columns are top to bottom. A resting board never contains an orthogonal 3,
  // so a bottom run is at most 2. Longer runs still animate if they ever occur.
  NS.LEVELS = [
    {
      id: 1,
      spoons: 5,
      title: '第一串',
      hint: '按最下面的勺子，抓住这一列，再滑到中间松手',
      hintCol: 0,
      demo: { from: 0, to: 2 },
      columns: [
        ['S', 'S'],
        [],
        ['S'],
        ['M', 'S', 'M', 'M'],
        [],
        []
      ]
    },
    {
      id: 2,
      spoons: 8,
      title: '三种果冻',
      hint: '把成对的果冻抛到同色的那一颗上',
      hintCol: 0,
      columns: [
        ['S', 'S'],
        ['G'],
        ['S'],
        ['M', 'M'],
        ['G', 'G'],
        ['M']
      ]
    },
    {
      id: 3,
      spoons: 6,
      title: '留下青提',
      hint: '只吸得走底部连续的草莓，上面的青提会留下',
      columns: [
        ['G', 'S', 'S'],
        [],
        ['S'],
        ['M', 'S', 'M', 'M'],
        ['G'],
        ['G']
      ]
    },
    {
      id: 4,
      spoons: 6,
      title: '再收一串',
      hint: '先让草莓连起来，再把三颗青提并到一起',
      columns: [
        ['S', 'S'],
        [],
        ['G', 'S'],
        ['M', 'S', 'M', 'M'],
        ['G'],
        ['G']
      ]
    }
  ];

  NS.TYPE_META = {
    S: { sprite: 'strawberry', name: '草莓' },
    M: { sprite: 'milk', name: '牛乳' },
    G: { sprite: 'mint', name: '青提' }
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof globalThis !== 'undefined' ? globalThis : this);
