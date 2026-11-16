// SVGO config for the Open Peeps illustration set.
// Used by scripts/generate-illustrations.ts through `npx svgo`; svgo is not a
// project dependency.
//
// Open Peeps are filled shapes in two colours: black "ink" and white "paper".
// `inkAndPaper` rewrites them so the generated React components can theme them:
//   black  -> fill="currentColor"   (follows the text colour)
//   white  -> no fill attribute     (inherits the <svg>'s fill, which the
//                                     component sets to the surface token)
// Anything inside <mask>, <clipPath> or <defs> is left alone.

const SHAPES = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "line"]);
const PROTECTED = new Set(["mask", "clipPath", "defs", "symbol", "pattern"]);
const BLACK = new Set(["#000", "#000000", "black", "#221e1f"]);
const WHITE = new Set(["#fff", "#ffffff", "white"]);

function walk(node, parents, visit) {
  for (const child of node.children ?? []) {
    if (child.type !== "element") continue;
    visit(child, parents);
    walk(child, [...parents, child], visit);
  }
}

const protectedBy = (parents) => parents.some((p) => PROTECTED.has(p.name));

/** Pass 1 (before the preset): give every shape its effective fill, then strip group fills. */
const pinFills = {
  name: "pinFills",
  fn: (root, _params, info) => {
    // Multipass re-runs every plugin; after pass 1 a missing fill means paper.
    if (info.multipassCount > 0) return {};
    walk(root, [], (node, parents) => {
      if (!SHAPES.has(node.name) || protectedBy(parents)) return;
      if (node.attributes.fill == null) {
        const inherited = [...parents].reverse().find((p) => p.attributes.fill != null);
        node.attributes.fill = inherited?.attributes.fill ?? "#000";
      }
      const fill = node.attributes.fill.toLowerCase();
      if (BLACK.has(fill)) node.attributes.fill = "currentColor";
      else if (WHITE.has(fill)) node.attributes.fill = "#fff";
      else if (fill !== "none") throw new Error(`Unexpected fill ${fill}`);
    });
    walk(root, [], (node, parents) => {
      if (protectedBy(parents) || PROTECTED.has(node.name)) return;
      if (node.name === "g" || node.name === "svg") {
        delete node.attributes.fill;
        delete node.attributes.stroke;
        delete node.attributes["stroke-width"];
      }
    });
    return {};
  },
};

/** Pass 2 (after the preset): push group fills down, then drop white so it inherits. */
const paperInherits = {
  name: "paperInherits",
  fn: (root) => {
    walk(root, [], (node, parents) => {
      if (protectedBy(parents) || PROTECTED.has(node.name)) return;
      if (node.name === "g" && node.attributes.fill != null) {
        for (const child of node.children) {
          if (child.type === "element" && child.attributes.fill == null) {
            child.attributes.fill = node.attributes.fill;
          }
        }
        delete node.attributes.fill;
      }
      if (SHAPES.has(node.name) && WHITE.has(String(node.attributes.fill).toLowerCase())) {
        delete node.attributes.fill;
      }
    });
    return {};
  },
};

export default {
  multipass: true,
  floatPrecision: 2,
  plugins: [
    pinFills,
    {
      name: "preset-default",
      params: { overrides: { removeUnknownsAndDefaults: { keepRoleAttr: true } } },
    },
    "removeTitle",
    "removeDesc",
    "removeDimensions",
    "removeXMLNS",
    { name: "removeAttrs", params: { attrs: ["data-name", "class"] } },
    paperInherits,
  ],
};
