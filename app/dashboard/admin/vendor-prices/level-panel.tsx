"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ItemPrices from "./item-prices";

export default function LevelPanel(props: any) {
  const { setMsg } = props;
  const supabase: any = createClient();
  const [levels, setLevels] = useState<any>([]);
  const [level, setLevel] = useState<any>(1);
  const [lvMarkup, setLvMarkup] = useState("10");
  const [busy, setBusy] = useState(false);
  const [tpl, setTpl] = useState<any>({ markup_pct: null, items: [] });

  async function loadTemplate(lvl: any) {
    const { data, error } = await supabase.rpc("admin_level_template", { p_level: lvl });
    if (!error && data) {
      setTpl(data);
    } else {
      setTpl({ markup_pct: null, items: [] });
    }
  }

  useEffect(() => {
    (async () => {
      const lv = await supabase.rpc("admin_level_counts");
      if (!lv.error && lv.data) {
        setLevels(lv.data);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTemplate(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const found = levels.find((x: any) => x.lvl === level);
  const count = found ? found.vendors : 0;

  async function levelFill(overwrite: boolean) {
    const pct = Number(lvMarkup);
    if (!isFinite(pct) || 0 > pct) {
      setMsg({ ok: false, text: "Enter a markup of 0 or more." });
      return;
    }
    if (count === 0) {
      setMsg({ ok: false, text: "There are no vendors at Level " + level + "." });
      return;
    }
    const ask = overwrite
      ? "Replace ALL prices for every Level " + level + " vendor (" + count + ") with cost + " + pct + "%?"
      : "Fill unpriced items for every Level " + level + " vendor (" + count + ") with cost + " + pct + "%?";
    if (!window.confirm(ask)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_fill_level_prices", {
      p_level: level,
      p_markup_pct: pct,
      p_overwrite: overwrite,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    const d: any = data || {};
    const sv = await supabase.rpc("admin_save_level_markup", {
      p_level: level,
      p_markup_pct: pct,
      p_overwrite: overwrite,
    });
    loadTemplate(level);
    setMsg({
      ok: !sv.error,
      text:
        "Level " + level + " done. Vendors: " + d.vendors + ", prices set: " + d.set +
        ", kept: " + d.kept + ", skipped: " + d.failed + "." +
        (sv.error
          ? " But saving it for future vendors failed: " + sv.error.message
          : " New Level " + level + " vendors will get this too."),
    });
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-sm font-semibold">Bulk prices by level</div>
      <p className="mt-1 text-xs text-ink/60">
        Level 1 = your direct vendors. Level 2 = their sub-vendors, and so on. Do Level 1
        first, then Level 2, because each level's cost is the level above's price.
      </p>
      {levels.length === 0 ? (
        <p className="mt-3 text-xs text-ink/50">No vendors yet.</p>
      ) : (
        <div>
          <div className="mt-3 flex flex-wrap gap-2">
            {levels.map((x: any) => (
              <button
                key={x.lvl}
                onClick={() => setLevel(x.lvl)}
                className={level === x.lvl ? "rounded-pill bg-indigo px-4 py-2 text-sm font-bold text-white" : "rounded-pill border border-line bg-white px-4 py-2 text-sm"}
              >
                Level {x.lvl} &middot; {x.vendors}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={lvMarkup}
              onChange={(e: any) => setLvMarkup(e.target.value)}
              inputMode="decimal"
              className="w-20 rounded-xl border border-line p-2 text-center text-base"
            />
            <span className="text-sm">% markup on their cost</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() => levelFill(false)}
              className="rounded-pill bg-gold px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Fill unpriced - Level {level}
            </button>
            <button
              disabled={busy}
              onClick={() => levelFill(true)}
              className="rounded-pill border border-line px-4 py-2 text-sm disabled:opacity-50"
            >
              Replace all - Level {level}
            </button>
          </div>
          <ItemPrices
            level={level}
            count={count}
            tpl={tpl}
            busy={busy}
            setBusy={setBusy}
            setMsg={setMsg}
            onSaved={() => loadTemplate(level)}
          />
        </div>
      )}
    </div>
  );
}

// END OF FILE
