"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports[Symbol.toStringTag] = "Module";
var main$1 = require("saus/src/bundle/main");
var saus = require("saus");
var react = require("@saus/react");
var React = require("react");
require("navaid");
require("saus/client");
var jsxRuntime = require("react/jsx-runtime");
function _interopDefaultLegacy(e) {
  return e && typeof e === "object" && "default" in e ? e : { "default": e };
}
var React__default = /* @__PURE__ */ _interopDefaultLegacy(React);
;
(function dedupeRequire(dedupe) {
  const Module = require("module");
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function(request, parent, isMain, options) {
    if (request[0] !== "." && request[0] !== "/") {
      const parts = request.split("/");
      const pkgName = parts[0][0] === "@" ? parts[0] + "/" + parts[1] : parts[0];
      if (dedupe.includes(pkgName)) {
        parent = module;
      }
    }
    return resolveFilename(request, parent, isMain, options);
  };
})(["react", "react-dom"]);
var main = main$1.main(async () => {
  await Promise.resolve().then(function() {
    return routes;
  });
  await Promise.resolve().then(function() {
    return render;
  });
});
var pokemon = [
  "Pikachu",
  "Bulbasaur",
  "Charmander",
  "Squirtle"
];
saus.route("/", () => Promise.resolve().then(function() {
  return Home$1;
}));
saus.route("/pokemon/:name", () => Promise.resolve().then(function() {
  return Pokemon$1;
}), {
  paths: () => pokemon.map((name) => name.toLowerCase())
});
saus.route(() => Promise.resolve().then(function() {
  return NotFound$1;
}));
var routes = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module"
});
"/".replace(/^\//, "");
function Router(props) {
  const [page, _setPage] = React__default["default"].useState(props.children);
  return page;
}
var App$1 = "";
function App(props) {
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [/* @__PURE__ */ jsxRuntime.jsx("header", {
      children: /* @__PURE__ */ jsxRuntime.jsx("img", {
        src: "/logo.png"
      })
    }), /* @__PURE__ */ jsxRuntime.jsx("main", {
      children: /* @__PURE__ */ jsxRuntime.jsx(Router, {
        children: props.children
      })
    })]
  });
}
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
react.render((module2, {
  params
}) => {
  const Page = module2.default;
  return /* @__PURE__ */ jsxRuntime.jsx(App, {
    children: /* @__PURE__ */ jsxRuntime.jsx(Page, __spreadValues({}, params))
  });
}, 97).head(() => /* @__PURE__ */ jsxRuntime.jsxs("head", {
  children: [/* @__PURE__ */ jsxRuntime.jsx("title", {
    children: "Pokemon Wiki"
  }), /* @__PURE__ */ jsxRuntime.jsx("link", {
    rel: "icon",
    type: "image/svg+xml",
    href: "/favicon.svg"
  }), /* @__PURE__ */ jsxRuntime.jsx("link", {
    href: "https://cdn.jsdelivr.net/npm/modern-normalize@1.1.0/modern-normalize.min.css",
    rel: "stylesheet"
  })]
}));
var render = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module"
});
function Home() {
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [/* @__PURE__ */ jsxRuntime.jsx("h1", {
      children: "Home"
    }), /* @__PURE__ */ jsxRuntime.jsxs("div", {
      children: [pokemon.map((name, i) => /* @__PURE__ */ jsxRuntime.jsx("a", {
        href: "/pokemon/" + name.toLowerCase(),
        children: name
      }, i)), /* @__PURE__ */ jsxRuntime.jsx("a", {
        href: "/broken-link",
        children: "404 Test"
      })]
    })]
  });
}
var Home$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  "default": Home
});
function Pokemon({
  name
}) {
  return /* @__PURE__ */ jsxRuntime.jsxs("div", {
    className: "pokemon",
    children: [/* @__PURE__ */ jsxRuntime.jsx("h1", {
      children: name[0].toUpperCase() + name.slice(1)
    }), /* @__PURE__ */ jsxRuntime.jsx("a", {
      href: "/",
      children: "Go back"
    }), /* @__PURE__ */ jsxRuntime.jsx("img", {
      src: "/" + name + ".webp",
      crossOrigin: "anonymous"
    })]
  });
}
var Pokemon$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  "default": Pokemon
});
var NotFound = () => /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, {
  children: [/* @__PURE__ */ jsxRuntime.jsx("h1", {
    children: "Page not found"
  }), /* @__PURE__ */ jsxRuntime.jsx("a", {
    href: "#",
    onClick: (e) => (e.preventDefault(), history.back()),
    children: "Go back"
  })]
});
var NotFound$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  "default": NotFound
});
exports["default"] = main;
