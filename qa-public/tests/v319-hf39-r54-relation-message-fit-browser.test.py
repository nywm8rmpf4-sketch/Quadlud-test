from __future__ import annotations

import importlib.util
from pathlib import Path

from playwright.sync_api import sync_playwright


HUMAN_TEST = Path(__file__).with_name("v319-hf39-r54-human-regression-browser.test.py")
spec = importlib.util.spec_from_file_location("quadlud_r54_human", HUMAN_TEST)
assert spec and spec.loader
human = importlib.util.module_from_spec(spec)
spec.loader.exec_module(human)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    context = browser.new_context(viewport=human.VIEWPORT, locale="fr-FR", has_touch=True, is_mobile=True)
    page = context.new_page()
    page.set_default_timeout(45000)
    errors: list[str] = []
    page.on("pageerror", lambda exc: errors.append("pageerror:" + str(exc)))
    page.on("console", lambda msg: errors.append("console:" + msg.text) if msg.type == "error" else None)

    human.load_runtime(page)
    human.install_human_fixture(page)
    page.locator("#walkthroughBtn").click()
    page.wait_for_selector(".walkthrough-panel")
    page.wait_for_timeout(150)
    human.next_logical_move(page, 1)

    state18 = None
    for move_number in range(1, human.TARGET_MOVES + 1):
        while True:
            proof_next = page.locator("#walkthroughProofNext")
            if not (proof_next.count() and proof_next.is_visible() and not proof_next.is_disabled()):
                break
            proof_next.click(timeout=10000)
            page.wait_for_timeout(120)
        if move_number == 18:
            state18 = human.group_state(page)
            break
        human.next_logical_move(page, move_number + 1)

    assert state18, "Human step 18 was not reached"
    assert state18["action"]["target"] == "F4", state18["action"]
    text = state18["explanation"].lower()
    for token in ("d4", "e4", "colonne 4", "f4", "soleil"):
        assert token in text, (token, state18["explanation"])
    scroll = state18["scroll"]
    assert scroll and scroll["scrollHeight"] <= scroll["clientHeight"] + 2, scroll
    assert scroll["scrollTop"] == 0, scroll
    assert not errors, errors

    context.close()
    browser.close()

print("PASS HF3.9-R5.4 relation message fit: step 18 keeps D4×E4→column 4→F4 reasoning visible without phone scroll.")
