/**
 * Thin wrapper over hono/jsx that accepts the React-style form props the
 * views were written with, so server-rendered HTML matches what React output:
 *   - defaultValue on input/textarea/select, defaultChecked on checkboxes
 *   - <form action={serverAction}> posts to the action endpoint
 */
import { Fragment, jsx as honoJsx, type JSX } from "hono/jsx/jsx-runtime";

type Props = Record<string, unknown> & { children?: unknown };

function markSelected(children: unknown, value: string): void {
  if (Array.isArray(children)) {
    for (const child of children) markSelected(child, value);
    return;
  }
  const node = children as { tag?: unknown; props?: Props } | null;
  if (node && node.tag === "option" && node.props) {
    node.props.selected = String(node.props.value) === value;
  }
}

function normalize(tag: unknown, props: Props): Props {
  if (typeof tag !== "string") return props;
  const next: Props = { ...props };

  if ("defaultChecked" in next) {
    if (!("checked" in next)) next.checked = Boolean(next.defaultChecked);
    delete next.defaultChecked;
  }

  if ("defaultValue" in next) {
    const value = next.defaultValue;
    delete next.defaultValue;
    if (tag === "textarea") {
      if (next.children === undefined) next.children = value == null ? "" : String(value);
    } else if (tag === "select") {
      if (value != null) markSelected(next.children, String(value));
    } else if (!("value" in next)) {
      next.value = value;
    }
  }

  if (tag === "form" && typeof next.action === "function") {
    // Wrangler bundles with keep_names, so the export name survives; the
    // action route only dispatches names present in its registry.
    next.action = `/_action/${(next.action as { name: string }).name}`;
    next.method = "post";
  }

  return next;
}

export function jsx(tag: unknown, props: Props, key?: string) {
  return honoJsx(tag as string, normalize(tag, props ?? {}), key);
}

export { Fragment, jsx as jsxs, jsx as jsxDEV, type JSX };
