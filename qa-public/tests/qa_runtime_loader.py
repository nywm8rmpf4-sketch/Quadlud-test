"""Test-only loader for QUADLUD browser harnesses.

The canonical runtime order is read from GitHub/index.html so QA harnesses do not
copy the product script list. Tests may explicitly exclude modules to exercise a
narrow boundary, and may append non-index scripts such as sw.js when required.
"""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


class _ScriptParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.sources: list[str] = []
        self.styles: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        attrs = dict(attrs)
        if tag.lower() == "script":
            src = attrs.get("src")
            if src:
                self.sources.append(src)
            return
        if tag.lower() == "link" and str(attrs.get("rel", "")).lower() == "stylesheet":
            href = attrs.get("href")
            if href:
                self.styles.append(href)


def runtime_module_order(web_root: Path) -> list[str]:
    """Return local runtime JS files in the exact order declared by index.html."""
    web_root = Path(web_root)
    parser = _ScriptParser()
    parser.feed((web_root / "index.html").read_text(encoding="utf-8"))
    out: list[str] = []
    for src in parser.sources:
        path = urlsplit(src).path
        name = Path(path).name
        if not name or not name.endswith(".js"):
            continue
        if not (web_root / name).is_file():
            raise FileNotFoundError(f"index runtime script missing: {name}")
        out.append(name)
    if len(out) != len(set(out)):
        raise ValueError("duplicate runtime script in index.html")
    return out


def runtime_style_order(web_root: Path) -> list[str]:
    """Return local runtime CSS files in the exact order declared by index.html."""
    web_root = Path(web_root)
    parser = _ScriptParser()
    parser.feed((web_root / "index.html").read_text(encoding="utf-8"))
    out: list[str] = []
    for href in parser.styles:
        path = urlsplit(href).path
        name = Path(path).name
        if not name or not name.endswith(".css"):
            continue
        if not (web_root / name).is_file():
            raise FileNotFoundError(f"index runtime stylesheet missing: {name}")
        out.append(name)
    if len(out) != len(set(out)):
        raise ValueError("duplicate runtime stylesheet in index.html")
    return out


def runtime_styles(web_root: Path) -> str:
    """Read all product stylesheets in product order as one QA-only CSS payload."""
    web_root = Path(web_root)
    return "".join((web_root / name).read_text(encoding="utf-8") for name in runtime_style_order(web_root))


def runtime_source_order(web_root: Path, *, include=(), exclude=(), extras=()) -> list[str]:
    """Resolve a test-only runtime subset while preserving product order."""
    web_root = Path(web_root)
    canonical = runtime_module_order(web_root)
    included = tuple(include)
    excluded = tuple(exclude)
    if included and excluded:
        raise ValueError("include and exclude are mutually exclusive")
    if len(included) != len(set(included)):
        raise ValueError("duplicate module in include")
    if len(excluded) != len(set(excluded)):
        raise ValueError("duplicate module in exclude")
    known = set(canonical)
    if included:
        missing = set(included).difference(known)
        if missing:
            raise ValueError(f"included modules are not in index.html: {sorted(missing)}")
        wanted = set(included)
        order = [name for name in canonical if name in wanted]
    else:
        missing = set(excluded).difference(known)
        if missing:
            raise ValueError(f"excluded modules are not in index.html: {sorted(missing)}")
        blocked = set(excluded)
        order = [name for name in canonical if name not in blocked]
    for name in extras:
        if name in order:
            raise ValueError(f"extra module already loaded from index.html: {name}")
        if not (web_root / name).is_file():
            raise FileNotFoundError(f"extra runtime script missing: {name}")
        order.append(name)
    return order


def runtime_sources(web_root: Path, *, include=(), exclude=(), extras=()) -> list[str]:
    """Read runtime sources in canonical product order for a QA-only selection."""
    web_root = Path(web_root)
    return [(web_root / name).read_text(encoding="utf-8") for name in runtime_source_order(web_root, include=include, exclude=exclude, extras=extras)]
