"""
Almanca Fiil Veri Seti — Hata Düzeltici
Kullanım:
    python fix_verbs.py <girdi.json> [çıktı.json]
Örnek:
    python fix_verbs.py verbs.json verbs_fixed.json
Çıktı dosyası belirtilmezse otomatik olarak <dosyaadi>_fixed.json oluşturulur.
"""

import json
import copy
import sys

# ─────────────────────────────────────────────────────────────────
# TÜM DÜZELTMELER (fiil → zaman → şahıs → doğru form)
# ─────────────────────────────────────────────────────────────────
FIXES = {

    # ══════════════════════════════════════════════════════════════
    # GRUP 1 — Modal Fiiller: wir / sie Präteritum  (-teen → -ten)
    # ══════════════════════════════════════════════════════════════
    "können": {
        "prateritum_full": {"wir": "konnten", "sie/Sie": "konnten"}
    },
    "müssen": {
        "prateritum_full": {"wir": "mussten", "sie/Sie": "mussten"}
    },
    "dürfen": {
        "prateritum_full": {"wir": "durften", "sie/Sie": "durften"}
    },
    "sollen": {
        "prateritum_full": {"wir": "sollten", "sie/Sie": "sollten"}
    },
    "wollen": {
        "prateritum_full": {"wir": "wollten", "sie/Sie": "wollten"}
    },
    "mögen": {
        "prateritum_full": {"wir": "mochten", "sie/Sie": "mochten"}
    },

    # ══════════════════════════════════════════════════════════════
    # GRUP 2 — Ayrılabilen Fiiller: Präteritum kişi ekleri
    #          (du/wir/ihr/sie formları ters kurulmuş)
    # ══════════════════════════════════════════════════════════════
    "anfangen": {
        "prateritum_full": {
            "du":      "fingst an",
            "wir":     "fingen an",
            "ihr":     "fingt an",
            "sie/Sie": "fingen an",
        }
    },
    "aufstehen": {
        "prateritum_full": {
            "du":      "standst auf",
            "wir":     "standen auf",
            "ihr":     "standet auf",
            "sie/Sie": "standen auf",
        },
        # Grup 5 — Konjunktiv II hatası da burada
        "konjunktiv2": {
            "wir":     "ständen auf",
            "sie/Sie": "ständen auf",
        },
    },
    "einschlafen": {
        "prateritum_full": {
            "du":      "schliefst ein",
            "wir":     "schliefen ein",
            "ihr":     "schlieft ein",
            "sie/Sie": "schliefen ein",
        }
    },
    "anrufen": {
        "prateritum_full": {
            "du":      "riefst an",
            "wir":     "riefen an",
            "ihr":     "rieft an",
            "sie/Sie": "riefen an",
        }
    },
    "mitbringen": {
        "prateritum_full": {
            "du":      "brachtest mit",
            "wir":     "brachten mit",
            "ihr":     "brachtet mit",
            "sie/Sie": "brachten mit",
        }
    },
    "vorschlagen": {
        "prateritum_full": {
            "du":      "schlugst vor",
            "wir":     "schlugen vor",
            "ihr":     "schlugt vor",
            "sie/Sie": "schlugen vor",
        }
    },
    "einladen": {
        "prateritum_full": {
            "du":      "ludst ein",
            "wir":     "luden ein",
            "ihr":     "ludt ein",
            "sie/Sie": "luden ein",
        }
    },
    "aufnehmen": {
        "prateritum_full": {
            "du":      "nahmst auf",
            "wir":     "nahmen auf",
            "ihr":     "nahmt auf",
            "sie/Sie": "nahmen auf",
        }
    },
    "umziehen": {
        "prateritum_full": {
            "du":      "zogst um",
            "wir":     "zogen um",
            "ihr":     "zogt um",
            "sie/Sie": "zogen um",
        }
    },
    "anziehen": {
        "prateritum_full": {
            "du":      "zogst an",
            "wir":     "zogen an",
            "ihr":     "zogt an",
            "sie/Sie": "zogen an",
        }
    },
    "zurückkommen": {
        "prateritum_full": {
            "du":      "kamst zurück",
            "wir":     "kamen zurück",
            "ihr":     "kamt zurück",
            "sie/Sie": "kamen zurück",
        }
    },
    "ausgeben": {
        "prateritum_full": {
            "du":      "gabst aus",
            "wir":     "gaben aus",
            "ihr":     "gabt aus",
            "sie/Sie": "gaben aus",
        }
    },
    "aufhalten": {
        "prateritum_full": {
            "du":      "hieltst auf",
            "wir":     "hielten auf",
            "ihr":     "hieltet auf",
            "sie/Sie": "hielten auf",
        }
    },
    "weglaufen": {
        "prateritum_full": {
            "du":      "liefst weg",
            "wir":     "liefen weg",
            "ihr":     "lieft weg",
            "sie/Sie": "liefen weg",
        }
    },
    "vorlesen": {
        "prateritum_full": {
            "du":      "last vor",
            "wir":     "lasen vor",
            "ihr":     "last vor",
            "sie/Sie": "lasen vor",
        }
    },
    "ausleihen": {
        "prateritum_full": {
            "du":      "liehst aus",
            "wir":     "liehen aus",
            "ihr":     "lieht aus",
            "sie/Sie": "liehen aus",
        }
    },
    "ankommen": {
        "prateritum_full": {
            "du":      "kamst an",
            "wir":     "kamen an",
            "ihr":     "kamt an",
            "sie/Sie": "kamen an",
        }
    },
    "abfahren": {
        "prateritum_full": {
            "du":      "fuhrst ab",
            "wir":     "fuhren ab",
            "ihr":     "fuhrt ab",
            "sie/Sie": "fuhren ab",
        }
    },
    "vorbeikommen": {
        "prateritum_full": {
            "du":      "kamst vorbei",
            "wir":     "kamen vorbei",
            "ihr":     "kamt vorbei",
            "sie/Sie": "kamen vorbei",
        }
    },
    "herausfinden": {
        "prateritum_full": {
            "du":      "fandst heraus",
            "wir":     "fanden heraus",
            "ihr":     "fandet heraus",
            "sie/Sie": "fanden heraus",
        }
    },
    "aufschreiben": {
        "prateritum_full": {
            "du":      "schriebst auf",
            "wir":     "schrieben auf",
            "ihr":     "schriebt auf",
            "sie/Sie": "schrieben auf",
        }
    },
    "einhalten": {
        "prateritum_full": {
            "du":      "hieltst ein",
            "wir":     "hielten ein",
            "ihr":     "hieltet ein",
            "sie/Sie": "hielten ein",
        }
    },
    "aufgeben": {
        "prateritum_full": {
            "du":      "gabst auf",
            "wir":     "gaben auf",
            "ihr":     "gabt auf",
            "sie/Sie": "gaben auf",
        }
    },
    "vorhaben": {
        "prateritum_full": {
            "du":      "hattest vor",
            "wir":     "hatten vor",
            "ihr":     "hattet vor",
            "sie/Sie": "hatten vor",
        }
    },
    "anbieten": {
        "prateritum_full": {
            "du":      "botst an",
            "wir":     "boten an",
            "ihr":     "botet an",
            "sie/Sie": "boten an",
        }
    },

    # ══════════════════════════════════════════════════════════════
    # GRUP 3 — Präteritum ihr: üçlü ünsüz → türeme -e-
    # ══════════════════════════════════════════════════════════════
    "bitten": {
        "prateritum_full": {"ihr": "batet"}
    },
    "reiten": {
        "prateritum_full": {"ihr": "rittet"}
    },
    "streiten": {
        "prateritum_full": {"ihr": "strittet"}
    },
    "leiden": {
        "prateritum_full": {"ihr": "littet"}
    },
    "bieten": {
        "prateritum_full": {"ihr": "botet"}
    },
    "erhalten": {
        "prateritum_full": {"ihr": "erhieltet"}
    },
    "behalten": {
        "prateritum_full": {"ihr": "behieltet"}
    },
    "treten": {
        "prateritum_full": {"ihr": "tratet"}
    },
    "schneiden": {
        "prateritum_full": {"ihr": "schnittet"}
    },
    "gelten": {
        "prateritum_full": {"ihr": "galtet"}
    },

    # ══════════════════════════════════════════════════════════════
    # GRUP 4 — Präteritum ihr: -dt → -det  (kök -nd/-nd ile biter)
    # ══════════════════════════════════════════════════════════════
    "stehen": {
        "prateritum_full": {"ihr": "standet"}
    },
    "verstehen": {
        "prateritum_full": {"ihr": "verstandet"}
    },
    "bestehen": {
        "prateritum_full": {"ihr": "bestandet"}
    },
    "entstehen": {
        "prateritum_full": {"ihr": "entstandet"}
    },
    "finden": {
        "prateritum_full": {"ihr": "fandet"}
    },
    "binden": {
        "prateritum_full": {"ihr": "bandet"}
    },
    "verbinden": {
        "prateritum_full": {"ihr": "verbandet"}
    },

    # ══════════════════════════════════════════════════════════════
    # GRUP 6 — erkennen Konjunktiv II (Präteritum ile karışmış)
    # ══════════════════════════════════════════════════════════════
    "erkennen": {
        "konjunktiv2": {
            "ich":      "erkennte",
            "du":       "erkenntest",
            "er/sie/es":"erkennte",
            "wir":      "erkennten",
            "ihr":      "erkenntet",
            "sie/Sie":  "erkennten",
        }
    },
}


# ─────────────────────────────────────────────────────────────────
def apply_fixes(data: dict) -> tuple[dict, int]:
    """Veriyi düzelt; (düzeltilmiş_veri, değişiklik_sayısı) döndür."""
    result = copy.deepcopy(data)
    total_changes = 0

    for verb in result["verbs"]:
        inf = verb["infinitiv"]
        if inf not in FIXES:
            continue

        verb_fixes = FIXES[inf]
        verb_changes = 0

        for tense, forms in verb_fixes.items():
            if tense not in verb:
                print(f"  [UYARI] '{inf}' fiilinde '{tense}' anahtarı bulunamadı, atlandı.")
                continue
            for person, correct_form in forms.items():
                if person not in verb[tense]:
                    print(f"  [UYARI] '{inf}.{tense}.{person}' bulunamadı, atlandı.")
                    continue
                old_form = verb[tense][person]
                if old_form != correct_form:
                    print(f"  [{inf}] {tense}.{person}:  '{old_form}'  →  '{correct_form}'")
                    verb[tense][person] = correct_form
                    verb_changes += 1

        if verb_changes:
            total_changes += verb_changes

    return result, total_changes


# ─────────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    input_path = sys.argv[1]
    if len(sys.argv) >= 3:
        output_path = sys.argv[2]
    else:
        base = input_path.rsplit(".", 1)
        output_path = base[0] + "_fixed." + base[1] if len(base) == 2 else input_path + "_fixed"

    # ── Oku ──────────────────────────────────────────────────────
    print(f"\n📂  Okunuyor : {input_path}")
    try:
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"HATA: '{input_path}' dosyası bulunamadı.")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"HATA: JSON ayrıştırılamadı — {e}")
        sys.exit(1)

    total_verbs = len(data.get("verbs", []))
    print(f"📊  Toplam fiil: {total_verbs}\n")
    print("─" * 70)

    # ── Düzelt ───────────────────────────────────────────────────
    fixed_data, change_count = apply_fixes(data)

    # ── Yaz ──────────────────────────────────────────────────────
    print("─" * 70)
    print(f"\n✅  Toplam {change_count} form düzeltildi.")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(fixed_data, f, ensure_ascii=False, indent=2)

    print(f"💾  Kaydedildi : {output_path}\n")


if __name__ == "__main__":
    main()
