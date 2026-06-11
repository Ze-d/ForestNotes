import { useCallback, useEffect, useRef } from "react";
import {
  EditorState,
  type Extension,
  Compartment,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

const themeCompartment = new Compartment();

export function MarkdownEditor({
  value,
  onChange,
  onSave,
}: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  // Keep callback refs current via effects (not during render)
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const setupEditor = useCallback(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          onSaveRef.current();
          return true;
        },
        preventDefault: true,
      },
    ]);

    const dark = prefersDark();

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      markdown(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      updateListener,
      saveKeymap,
      themeCompartment.of(dark ? oneDark : []),
    ];

    const state = EditorState.create({ doc: value, extensions });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    // Handle color scheme changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleColorScheme = () => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: themeCompartment.reconfigure(
            mq.matches ? oneDark : [],
          ),
        });
      }
    };
    mq.addEventListener("change", handleColorScheme);

    return () => {
      mq.removeEventListener("change", handleColorScheme);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cleanup = setupEditor();
    return () => cleanup?.();
  }, [setupEditor]);

  // Update content when value changes externally (switching notes)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div className="codemirror-wrapper" ref={editorRef} />;
}
