/* 第 1–3 关数据。坐标是相对舞台的百分比，车头朝向右前方，出路在停车场下方。 */
const LINE = {
  A: { bus: "assets/bus-a.png", pax: "assets/passenger-a.png", label: "A" },
  B: { bus: "assets/bus-b.png", pax: "assets/passenger-b.png", label: "B" },
  C: { bus: "assets/bus-c.png", pax: "assets/passenger-c.png", label: "C" }
};

/* 三个车位中心（匹配背景里的停车格），以及每辆车前方的挡路点 */
const STALL = [
  { x: 26, y: 58 },
  { x: 50, y: 56 },
  { x: 74, y: 54 }
];
const AHEAD = [
  { x: 32, y: 68 },
  { x: 56, y: 66 },
  { x: 80, y: 64 }
];

const LEVELS = [
  {
    id: 1,
    title: "第 1 关",
    hint: "点那辆蓝色巴士，接走 A 线乘客。",
    slots: 3,
    queue: ["A", "A"],
    capacity: 2,
    vehicles: [
      { id: "busA", kind: "bus", line: "A", stall: 1, blockedBy: null }
    ]
  },
  {
    id: 2,
    title: "第 2 关",
    hint: "被挡住的车开不动，先把米色小车开走。",
    slots: 3,
    queue: ["A", "A", "B", "B"],
    capacity: 2,
    vehicles: [
      { id: "car1", kind: "car", line: null, stall: 0, at: "ahead", blockedBy: null },
      { id: "busA", kind: "bus", line: "A", stall: 0, blockedBy: "car1" },
      { id: "busB", kind: "bus", line: "B", stall: 2, blockedBy: null }
    ]
  },
  {
    id: 3,
    title: "第 3 关",
    hint: "上客槽只有两个，要按队首顺序发车。",
    slots: 2,
    queue: ["A", "A", "B", "B", "C", "C"],
    capacity: 2,
    vehicles: [
      { id: "busA", kind: "bus", line: "A", stall: 0, blockedBy: null },
      { id: "busB", kind: "bus", line: "B", stall: 1, blockedBy: null },
      { id: "busC", kind: "bus", line: "C", stall: 2, blockedBy: null }
    ]
  }
];
