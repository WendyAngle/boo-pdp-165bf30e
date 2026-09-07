// 商品分类与 HS6 编码数据 (高保真原型,数据为示例)

export interface L4Item {
  name: string;
  en: string;
  hs: string; // HS6 code
}
export interface L3Item {
  name: string;
  en: string;
  l4: L4Item[];
}
export interface L2Item {
  name: string;
  en: string;
  l3: L3Item[];
}
export interface L1Item {
  name: string;
  en: string;
  l2: L2Item[];
}

// 主示例 L1: 建材、陶瓷、玻璃与石材 (来自参考截图)
const BUILDING: L1Item = {
  name: "建材、陶瓷、玻璃与石材",
  en: "Building Materials, Ceramics, Glass and Stone",
  l2: [
    {
      name: "加工石材、石膏与水泥制品",
      en: "Worked Stone, Plaster and Cement Articles",
      l3: [
        {
          name: "石材制品",
          en: "stone articles",
          l4: [
            { name: "天然石铺路制品", en: "natural stone paving articles", hs: "680100" },
            { name: "石材砖块及粒粉", en: "stone tiles cubes and granules", hs: "680210" },
            { name: "大理石灰华及雪花石膏制品", en: "marble travertine and alabaster articles", hs: "680221" },
            { name: "花岗岩制品", en: "granite articles", hs: "680223" },
            { name: "建筑石材制品", en: "building stone articles", hs: "680229" },
            { name: "钙质石材制品", en: "calcareous stone articles", hs: "680292" },
            { name: "天然石材制品", en: "natural stone articles", hs: "680299" },
            { name: "板岩制品", en: "slate articles", hs: "680300" },
          ],
        },
        {
          name: "石膏制品",
          en: "plaster articles",
          l4: [
            { name: "石膏板", en: "gypsum boards", hs: "680911" },
            { name: "其他石膏制品", en: "other plaster articles", hs: "680919" },
          ],
        },
      ],
    },
    {
      name: "混凝土制品与预制构件",
      en: "Concrete Articles and Prefabricated Components",
      l3: [
        {
          name: "混凝土砌块与砖",
          en: "concrete blocks and bricks",
          l4: [
            { name: "混凝土砌块", en: "concrete blocks", hs: "681011" },
            { name: "预制混凝土构件", en: "precast concrete components", hs: "681091" },
          ],
        },
      ],
    },
    {
      name: "磨料、沥青、云母与石棉制品",
      en: "Abrasives, Asphalt, Mica and Asbestos Articles",
      l3: [
        {
          name: "磨料制品",
          en: "abrasive products",
          l4: [
            { name: "天然磨料", en: "natural abrasives", hs: "680410" },
            { name: "人造磨料", en: "artificial abrasives", hs: "680422" },
          ],
        },
      ],
    },
    {
      name: "陶瓷建材与耐火陶瓷",
      en: "Ceramic Building Materials and Refractory Ceramics",
      l3: [
        {
          name: "耐火砖与耐火制品",
          en: "refractory bricks",
          l4: [
            { name: "耐火砖", en: "refractory bricks", hs: "690210" },
            { name: "高铝耐火制品", en: "high-alumina refractories", hs: "690220" },
          ],
        },
      ],
    },
    {
      name: "日用、卫生与工业陶瓷",
      en: "Household, Sanitary and Industrial Ceramics",
      l3: [
        {
          name: "卫生陶瓷",
          en: "sanitary ceramics",
          l4: [
            { name: "陶瓷洗手盆", en: "ceramic wash basins", hs: "691010" },
            { name: "陶瓷浴缸", en: "ceramic bathtubs", hs: "691090" },
          ],
        },
      ],
    },
    {
      name: "玻璃、玻璃器皿与建筑玻璃",
      en: "Glass, Glassware and Building Glass",
      l3: [
        {
          name: "建筑玻璃",
          en: "building glass",
          l4: [
            { name: "钢化安全玻璃", en: "tempered safety glass", hs: "700711" },
            { name: "夹层安全玻璃", en: "laminated safety glass", hs: "700721" },
          ],
        },
      ],
    },
    {
      name: "玻璃纤维与玻璃材料制品",
      en: "Glass Fibers and Glass Material Articles",
      l3: [
        {
          name: "玻璃纤维",
          en: "glass fibers",
          l4: [
            { name: "玻璃纤维粗纱", en: "glass fiber rovings", hs: "701912" },
            { name: "玻璃纤维布", en: "glass fiber fabric", hs: "701940" },
          ],
        },
      ],
    },
  ],
};

// 其它 L1 (简化版,L2/L3/L4 为示例性数据,体现层级深度)
function makeL1(
  name: string,
  en: string,
  l2Names: [string, string][],
  basePrefix: string,
): L1Item {
  return {
    name,
    en,
    l2: l2Names.map(([n, e], i) => ({
      name: n,
      en: e,
      l3: [
        {
          name: `${n.slice(0, 4)}主类`,
          en: `${e.split(" ")[0]} main category`,
          l4: Array.from({ length: 3 }).map((_, j) => ({
            name: `${n.slice(0, 4)}产品${j + 1}`,
            en: `${e.split(" ")[0].toLowerCase()} product ${j + 1}`,
            hs: `${basePrefix}${pad(i + 1)}${pad(j + 1)}`,
          })),
        },
      ],
    })),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export const CATALOG: L1Item[] = [
  makeL1(
    "农牧渔产品与食品饮料",
    "Agricultural, Fishery Products, Food and Beverages",
    [
      ["活动物与畜产品", "Live Animals and Livestock"],
      ["肉类与食用杂碎", "Meat and Edible Offal"],
      ["水产品", "Aquatic Products"],
      ["乳制品与蛋品", "Dairy and Eggs"],
      ["蔬菜与食用根茎", "Vegetables and Roots"],
      ["水果与坚果", "Fruits and Nuts"],
    ],
    "0101",
  ),
  makeL1(
    "能源、矿产与初级原料",
    "Energy, Minerals and Primary Raw Materials",
    [
      ["金属矿与矿砂", "Metal Ores"],
      ["矿物燃料与原油", "Mineral Fuels and Crude Oil"],
      ["天然气与液化气", "Natural and Liquefied Gas"],
      ["盐与硫磺", "Salt and Sulfur"],
    ],
    "2601",
  ),
  makeL1(
    "化工品、医药与精细化学品",
    "Chemicals, Pharmaceuticals and Fine Chemicals",
    [
      ["无机化工品", "Inorganic Chemicals"],
      ["有机化工品", "Organic Chemicals"],
      ["医药品", "Pharmaceuticals"],
      ["染料颜料与涂料", "Dyes, Pigments and Coatings"],
      ["香精油与日化品", "Essential Oils and Cosmetics"],
    ],
    "2801",
  ),
  makeL1(
    "塑料、橡胶及其制品",
    "Plastics, Rubber and Articles",
    [
      ["塑料原料", "Plastic Raw Materials"],
      ["塑料制品", "Plastic Articles"],
      ["橡胶原料", "Rubber Raw Materials"],
      ["橡胶制品", "Rubber Articles"],
    ],
    "3901",
  ),
  makeL1(
    "木材、纸浆、纸品与印刷品",
    "Wood, Pulp, Paper Products and Printed Matter",
    [
      ["原木与木材", "Wood and Timber"],
      ["木制品", "Wooden Articles"],
      ["纸浆", "Wood Pulp"],
      ["纸与纸板", "Paper and Paperboard"],
      ["印刷品", "Printed Matter"],
    ],
    "4401",
  ),
  makeL1(
    "纺织、服装与家纺",
    "Textiles, Apparel and Home Textiles",
    [
      ["天然纤维与丝绸", "Natural Fibers and Silk"],
      ["化学纤维", "Chemical Fibers"],
      ["机织物与针织物", "Woven and Knitted Fabrics"],
      ["服装", "Apparel"],
      ["家用纺织品", "Home Textiles"],
    ],
    "5001",
  ),
  makeL1(
    "皮革、鞋帽、箱包与配饰",
    "Leather, Footwear, Headgear, Bags and Accessories",
    [
      ["原皮与皮革", "Hides and Leather"],
      ["皮革制品与箱包", "Leather Articles and Bags"],
      ["鞋类", "Footwear"],
      ["帽类与配饰", "Headgear and Accessories"],
    ],
    "4101",
  ),
  BUILDING,
  makeL1(
    "金属材料与金属制品",
    "Metals and Metal Articles",
    [
      ["钢铁原料", "Iron and Steel"],
      ["钢铁制品", "Iron and Steel Articles"],
      ["铜与铜制品", "Copper and Articles"],
      ["铝与铝制品", "Aluminium and Articles"],
      ["其他贱金属", "Other Base Metals"],
    ],
    "7201",
  ),
  makeL1(
    "机械设备与电气设备",
    "Machinery and Electrical Equipment",
    [
      ["核反应堆与机械", "Nuclear Reactors and Machinery"],
      ["电气设备", "Electrical Equipment"],
      ["计算机与外设", "Computers and Peripherals"],
    ],
    "8401",
  ),
  makeL1(
    "运输设备与零部件",
    "Transport Equipment and Parts",
    [
      ["机动车辆", "Motor Vehicles"],
      ["航空航天器", "Aircraft and Spacecraft"],
      ["船舶", "Ships and Boats"],
    ],
    "8701",
  ),
  makeL1(
    "光学、医疗与精密仪器",
    "Optical, Medical and Precision Instruments",
    [
      ["光学仪器", "Optical Instruments"],
      ["医疗仪器", "Medical Instruments"],
      ["计量与检测仪器", "Measuring and Testing"],
    ],
    "9001",
  ),
];

// 反向索引: hs -> { l1, l2, l3, l4 }
export interface HsLookup {
  l1: L1Item;
  l2: L2Item;
  l3: L3Item;
  l4: L4Item;
}

const HS_INDEX = new Map<string, HsLookup>();
for (const l1 of CATALOG) {
  for (const l2 of l1.l2) {
    for (const l3 of l2.l3) {
      for (const l4 of l3.l4) {
        HS_INDEX.set(l4.hs, { l1, l2, l3, l4 });
      }
    }
  }
}

export function findByHs(hs: string): HsLookup | undefined {
  return HS_INDEX.get(hs);
}

export function categoryStats(l1: L1Item) {
  let l2Count = l1.l2.length;
  let l4Count = 0;
  for (const l2 of l1.l2) {
    for (const l3 of l2.l3) {
      l4Count += l3.l4.length;
    }
  }
  return { l2Count, l4Count };
}

export function totalProducts() {
  return CATALOG.reduce((s, l1) => s + categoryStats(l1).l4Count, 0);
}