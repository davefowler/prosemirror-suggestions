import {
  EditorState,
  Plugin,
  Selection,
  TextSelection,
} from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser, MarkSpec } from "prosemirror-model";
import { suggestionsPlugin } from "../../src/suggestions";
import { suggestionsPluginKey } from "../../src/key";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";

describe("suggestionsPlugin integration", () => {
  let view: EditorView;
  let state: EditorState;
  let container: HTMLElement;

  // Create a schema with suggestion marks
  const schema = new Schema({
    nodes: basicSchema.spec.nodes,
    marks: {
      ...basicSchema.spec.marks,
      suggestion_add: {
        attrs: {
          username: { default: "" },
          createdAt: { default: 0 },
          data: { default: null },
        },
        inclusive: false,
        excludes: "",
        parseDOM: [{ tag: "span.suggestion-add" }],
        toDOM() {
          return ["span", { class: "suggestion-add" }, 0];
        },
      },
      suggestion_delete: {
        attrs: {
          username: { default: "" },
          createdAt: { default: 0 },
          data: { default: null },
        },
        inclusive: false,
        excludes: "",
        parseDOM: [{ tag: "span.suggestion-delete" }],
        toDOM() {
          return ["span", { class: "suggestion-delete" }, 0];
        },
      },
    },
  });

  // Helper to create a basic editor with our plugin
  function createEditor(
    content: string = "<p>Hello world</p>",
    pluginState = {}
  ) {
    // Create container for the editor
    container = document.createElement("div");
    document.body.appendChild(container);

    // Parse the content
    const domNode = document.createElement("div");
    domNode.innerHTML = content;
    const doc = DOMParser.fromSchema(schema).parse(domNode);

    // Create the state with our plugin
    state = EditorState.create({
      doc,
      schema,
      plugins: [keymap(baseKeymap), suggestionsPlugin],
    });

    // Create the editor view
    view = new EditorView(container, { state });

    // Configure the plugin with the desired state
    view.dispatch(
      view.state.tr.setMeta(suggestionsPluginKey, {
        inSuggestionMode: true,
        username: "testUser",
        data: { "example-attr": "test value" },
        ...pluginState,
      })
    );

    return view;
  }

  afterEach(() => {
    if (view) {
      view.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe("suggestion mode", () => {
    test("should initialize with suggestion mode enabled", () => {
      createEditor();
      const pluginState = suggestionsPluginKey.getState(view.state);

      expect(pluginState).toBeDefined();
      expect(pluginState.inSuggestionMode).toBe(true);
      expect(pluginState.username).toBe("testUser");
    });

    test("should toggle suggestion mode", () => {
      createEditor();

      // Get initial state
      let pluginState = suggestionsPluginKey.getState(view.state);
      expect(pluginState.inSuggestionMode).toBe(true);

      // Toggle suggestion mode off
      view.dispatch(
        view.state.tr.setMeta(suggestionsPluginKey, {
          inSuggestionMode: false,
        })
      );

      // Check that it's off
      pluginState = suggestionsPluginKey.getState(view.state);
      expect(pluginState.inSuggestionMode).toBe(false);

      // Toggle it back on
      view.dispatch(
        view.state.tr.setMeta(suggestionsPluginKey, {
          inSuggestionMode: true,
        })
      );

      // Check that it's on again
      pluginState = suggestionsPluginKey.getState(view.state);
      expect(pluginState.inSuggestionMode).toBe(true);
    });
  });

  describe("text operations", () => {
    test("should mark inserted text with suggestion_add", () => {
      createEditor("<p>Hello world</p>");

      // Position cursor after "Hello "
      const position = 7;
      const tr = view.state.tr.setSelection(
        Selection.near(view.state.doc.resolve(position))
      );
      view.dispatch(tr);

      // Insert text with a space
      view.dispatch(view.state.tr.insertText(" awesome "));

      // Check that the document now contains the text
      expect(view.state.doc.textContent).toBe("Hello  awesome world");

      // Check that there's a suggestion_add mark
      let foundMark = false;
      view.state.doc.nodesBetween(position, position + 8, (node) => {
        if (node.marks.some((mark) => mark.type.name === "suggestion_add")) {
          foundMark = true;
        }
      });

      expect(foundMark).toBe(true);
    });

    test("should mark deleted text with suggestion_delete", () => {
      createEditor("<p>Hello awesome world</p>");

      // Select " awesome "
      const from = 7;
      const to = 16;
      const tr = view.state.tr.setSelection(
        TextSelection.create(view.state.doc, from, to)
      );
      view.dispatch(tr);

      // Delete the selected text
      view.dispatch(view.state.tr.deleteSelection());

      // Check that the document still contains"Hello  awesome world"
      expect(view.state.doc.textContent).toBe("Hello awesome world");

      // Check that there's a suggestion_delete mark
      let foundMark = false;
      view.state.doc.nodesBetween(from, from + 8, (node) => {
        if (node.marks.some((mark) => mark.type.name === "suggestion_delete")) {
          foundMark = true;
        }
      });

      expect(foundMark).toBe(true);
    });
  });

  describe("custom data", () => {
    test("should pass custom data to suggestion marks", () => {
      createEditor("<p>Hello world</p>", {
        data: { exampleattr: "test value" },
      });

      // Position cursor after "Hello "
      const position = 7;
      const tr = view.state.tr.setSelection(
        Selection.near(view.state.doc.resolve(position))
      );
      view.dispatch(tr);

      // Insert text with a space
      view.dispatch(view.state.tr.insertText(" awesome "));

      // Check that the document now contains the text
      expect(view.state.doc.textContent).toBe("Hello  awesome world");

      // Check that there's a suggestion_add mark with our custom data
      let markWithData = null;
      view.state.doc.nodesBetween(position, position + 8, (node) => {
        node.marks.forEach((mark) => {
          if (mark.type.name === "suggestion_add") {
            markWithData = mark;
          }
        });
      });

      expect(markWithData).not.toBeNull();
      expect(markWithData.attrs.data).toEqual({ exampleattr: "test value" });
    });
  });

  describe("decorations", () => {
    test("should add decorations for suggestion marks", () => {
      createEditor("<p>Hello world</p>");

      // Position cursor after "Hello "
      const position = 6;
      const tr = view.state.tr.setSelection(
        Selection.near(view.state.doc.resolve(position))
      );
      view.dispatch(tr);

      // Insert text
      view.dispatch(view.state.tr.insertText("awesome "));

      // Force a DOM update
      view.updateState(view.state);

      // Check that there's a decoration with the suggestion-add class
      const decorations = container.querySelectorAll(".suggestion-add");
      expect(decorations.length).toBeGreaterThan(0);

      // Check that there's a tooltip
      const tooltips = container.querySelectorAll(".suggestion-tooltip");
      expect(tooltips.length).toBeGreaterThan(0);
    });
  });
});
