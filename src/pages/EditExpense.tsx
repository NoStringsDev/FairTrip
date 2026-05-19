import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { db } from "../db/database";
import { newId } from "../utils/id";
import type { CurrencyCode, Expense, SplitMode, Trip } from "../types";
import { EntityChip } from "../components/EntityChip";
import { minorUnitsFor, parseAmountToMinor, formatMinor } from "../domain/currency";
import { compressDataUrl } from "../utils/image";
import { saveExpense } from "../services/expenseSave";
import { schedulePush } from "../services/tripSync";
import { normalizeExpense } from "../lib/expenseNormalize";
import { normalizeTrip } from "../lib/tripNormalize";

type Ctx = { trip: Trip };

export function EditExpense() {
  const { trip: rawTrip } = useOutletContext<Ctx>();
  const trip = normalizeTrip(rawTrip);
  const { expenseId } = useParams();
  const nav = useNavigate();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [expense, setExpense] = useState<Expense | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(trip.tripCurrency);
  const [payer, setPayer] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>("shared_equal");
  const [beneficiary, setBeneficiary] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");
  const [manualGbp, setManualGbp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!expenseId) return;
    void db.expenses.get(expenseId).then((e) => {
      if (!e || e.tripId !== trip.id) {
        nav(`/trip/${trip.id}/history`);
        return;
      }
      const ex = normalizeExpense(e, trip);
      setExpense(e);
      setAmount((e.amountMinorUnits / minorUnitsFor(e.currencyCode)).toString());
      setCurrency(e.currencyCode);
      setPayer(ex.payerEntityId);
      setSplitMode(ex.splitMode);
      setBeneficiary(ex.beneficiaryEntityId ?? trip.entities[0]?.id ?? "");
      setNote(e.note);
      setWhen(formatDateTimeLocal(new Date(e.expenseTimestamp)));
      if (e.manualGbpMinorUnits != null) {
        setManualGbp((e.manualGbpMinorUnits / 100).toFixed(2));
      } else {
        setManualGbp("");
      }
    });
  }, [expenseId, nav, trip]);

  const closed = Boolean(trip.closedAt);

  const canSave = useMemo(() => {
    const minor = parseAmountToMinor(amount, currency);
    if (minor == null || minor <= 0 || busy || !expense || closed) return false;
    if (!payer) return false;
    if (splitMode === "single" && !beneficiary) return false;
    return true;
  }, [amount, beneficiary, busy, closed, currency, expense, payer, splitMode]);

  async function save() {
    if (!expense) return;
    const minor = parseAmountToMinor(amount, currency);
    if (minor == null || minor <= 0) return;
    setBusy(true);
    try {
      const manualMinor =
        manualGbp.trim() === ""
          ? undefined
          : Math.round(Number.parseFloat(manualGbp) * 100);
      const next: Expense = {
        ...expense,
        amountMinorUnits: minor,
        currencyCode: currency,
        payerEntityId: payer,
        splitMode,
        beneficiaryEntityId:
          splitMode === "single" ? beneficiary : undefined,
        note,
        expenseTimestamp: new Date(when).getTime(),
        updatedAt: Date.now(),
        manualGbpMinorUnits:
          manualMinor != null && Number.isFinite(manualMinor)
            ? manualMinor
            : undefined,
        conversionMode:
          manualMinor != null && Number.isFinite(manualMinor)
            ? "manualOverride"
            : "auto",
      };
      await saveExpense(next);
      void schedulePush(trip.id);
      nav(`/trip/${trip.id}/history`);
    } finally {
      setBusy(false);
    }
  }

  async function softDelete() {
    if (!expense) return;
    if (!confirm("Delete this expense?")) return;
    await db.expenses.update(expense.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
    void schedulePush(trip.id);
    nav(`/trip/${trip.id}/history`);
  }

  async function onReceiptReplace(f: File | null) {
    if (!f || !expense) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result);
      const compressed = await compressDataUrl(raw);
      const rid = newId();
      await db.receipts.put({
        id: rid,
        dataUrl: compressed,
        createdAt: Date.now(),
      });
      const next: Expense = {
        ...expense,
        receiptLocalBlobId: rid,
        receiptR2Key: undefined,
        updatedAt: Date.now(),
      };
      await db.expenses.put(next);
      setExpense(next);
      void schedulePush(trip.id);
    };
    reader.readAsDataURL(f);
  }

  if (!expense) return null;

  return (
    <div className="stack">
      <div className="card stack">
        <h2 className="title" style={{ fontSize: "1rem" }}>
          Edit expense
        </h2>

        <div className="field">
          <label>Title</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="field">
          <label>Amount</label>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Currency</label>
          <div className="currency-grid">
            {trip.supportedCurrencies.map((c) => (
              <button
                key={c}
                type="button"
                className={currency === c ? "btn" : "btn btn-ghost"}
                onClick={() => setCurrency(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Paid by</label>
          <div className="entity-picker">
            {trip.entities.map((ent) => (
              <button
                key={ent.id}
                type="button"
                className={`entity-picker__opt${payer === ent.id ? " entity-picker__opt--on" : ""}`}
                onClick={() => setPayer(ent.id)}
              >
                <EntityChip entity={ent} size="sm" />
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Who is this for?</label>
          <select
            value={splitMode}
            onChange={(e) => setSplitMode(e.target.value as SplitMode)}
          >
            <option value="shared_equal">Everyone (split evenly)</option>
            <option value="single">One group only</option>
          </select>
        </div>

        {splitMode === "single" ? (
          <div className="field">
            <label>For</label>
            <div className="entity-picker">
              {trip.entities.map((ent) => (
                <button
                  key={ent.id}
                  type="button"
                  className={`entity-picker__opt${beneficiary === ent.id ? " entity-picker__opt--on" : ""}`}
                  onClick={() => setBeneficiary(ent.id)}
                >
                  <EntityChip entity={ent} size="sm" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="field">
          <label>When</label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Manual GBP override (optional)</label>
          <input
            inputMode="decimal"
            placeholder="e.g. 12.34 — overrides FX for settlement"
            value={manualGbp}
            onChange={(e) => setManualGbp(e.target.value)}
          />
          <p className="sub" style={{ margin: "6px 0 0" }}>
            Leave blank to use automatic conversion. Current auto ≈{" "}
            {expense.convertedGbpMinorUnits != null
              ? formatMinor(expense.convertedGbpMinorUnits, "GBP")
              : "—"}
          </p>
        </div>

        <button
          className="btn btn-lg"
          disabled={!canSave}
          onClick={() => void save()}
        >
          Save changes
        </button>

        {!closed ? (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void softDelete()}
          >
            Delete expense
          </button>
        ) : null}

        <div className="field">
          <label>Replace receipt (optional)</label>
          <div className="receipt-actions row" style={{ flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => cameraInputRef.current?.click()}
            >
              Take photo
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => galleryInputRef.current?.click()}
            >
              Choose from library
            </button>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="visually-hidden"
            onChange={(e) => void onReceiptReplace(e.target.files?.[0] ?? null)}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(e) => void onReceiptReplace(e.target.files?.[0] ?? null)}
          />
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => nav(`/trip/${trip.id}/history`)}
        >
          Back
        </button>
      </div>
    </div>
  );
}
