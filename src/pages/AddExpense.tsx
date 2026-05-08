import { useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { CurrencyCode, Expense, SplitMode, Trip } from "../types";
import { EntityChip } from "../components/EntityChip";
import { newId } from "../utils/id";
import { compressDataUrl } from "../utils/image";
import { runReceiptOcr } from "../services/ocr";
import { minorUnitsFor, parseAmountToMinor } from "../domain/currency";
import { saveExpense } from "../services/expenseSave";
import { schedulePush } from "../services/tripSync";
import { db } from "../db/database";
import { uploadReceipt } from "../services/sync";
import { normalizeTrip } from "../lib/tripNormalize";

type Ctx = { trip: Trip };

export function AddExpense() {
  const { trip: rawTrip } = useOutletContext<Ctx>();
  const trip = normalizeTrip(rawTrip);
  const nav = useNavigate();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(
    trip.supportedCurrencies.includes(trip.tripCurrency)
      ? trip.tripCurrency
      : trip.supportedCurrencies[0] ?? "GBP"
  );
  const [payer, setPayer] = useState(trip.entities[0]?.id ?? "");
  const [splitMode, setSplitMode] = useState<SplitMode>("shared_equal");
  const [beneficiary, setBeneficiary] = useState(
    trip.entities[1]?.id ?? trip.entities[0]?.id ?? ""
  );
  const [note, setNote] = useState("");
  const [when, setWhen] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrPct, setOcrPct] = useState(0);
  const [busy, setBusy] = useState(false);

  const closed = Boolean(trip.closedAt);

  const canSubmit = useMemo(() => {
    const minor = parseAmountToMinor(amount, currency);
    if (minor == null || minor <= 0 || busy || closed) return false;
    if (!payer) return false;
    if (splitMode === "single" && !beneficiary) return false;
    return true;
  }, [amount, beneficiary, busy, closed, currency, payer, splitMode]);

  async function onPickReceipt(f: File | null) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result);
      const compressed = await compressDataUrl(raw);
      setReceiptPreview(compressed);
      setOcrBusy(true);
      setOcrPct(0);
      try {
        const draft = await runReceiptOcr(compressed, setOcrPct);
        if (draft.detectedCurrencyCode && trip.supportedCurrencies.includes(draft.detectedCurrencyCode)) {
          setCurrency(draft.detectedCurrencyCode);
        }
        const detCur = draft.detectedCurrencyCode ?? currency;
        if (draft.detectedTotalMinorUnits != null) {
          setAmount(
            (
              draft.detectedTotalMinorUnits / minorUnitsFor(detCur)
            ).toString()
          );
        }
        if (draft.detectedDate) {
          const d = new Date(draft.detectedDate + "T12:00:00");
          setWhen(d.toISOString().slice(0, 16));
        }
        if (draft.detectedMerchant) setNote(draft.detectedMerchant);
      } finally {
        setOcrBusy(false);
      }
    };
    reader.readAsDataURL(f);
  }

  async function submit() {
    const minor = parseAmountToMinor(amount, currency);
    if (minor == null || minor <= 0) return;
    setBusy(true);
    try {
      const expenseId = newId();
      let receiptLocalBlobId: string | undefined;
      if (receiptPreview) {
        receiptLocalBlobId = newId();
        await db.receipts.put({
          id: receiptLocalBlobId,
          dataUrl: receiptPreview,
          createdAt: Date.now(),
        });
      }
      const base: Expense = {
        id: expenseId,
        tripId: trip.id,
        amountMinorUnits: minor,
        currencyCode: currency,
        payerEntityId: payer,
        splitMode,
        beneficiaryEntityId:
          splitMode === "single" ? beneficiary : undefined,
        note,
        category: "",
        expenseTimestamp: new Date(when).getTime(),
        receiptLocalBlobId,
        updatedAt: Date.now(),
        conversionMode: "auto",
      };
      await saveExpense(base);
      void schedulePush(trip.id);
      if (receiptPreview && receiptLocalBlobId) {
        try {
          const blob = await (await fetch(receiptPreview)).blob();
          const up = await uploadReceipt(trip.tripCode, expenseId, blob);
          if (up?.r2Key) {
            await db.expenses.update(expenseId, { receiptR2Key: up.r2Key });
            void schedulePush(trip.id);
          }
        } catch {
          // offline upload; ignore
        }
      }
      nav(`/trip/${trip.id}/balance`);
    } finally {
      setBusy(false);
    }
  }

  if (closed) {
    return (
      <div className="card">
        <p className="sub">This trip is closed — add is disabled.</p>
      </div>
    );
  }

  return (
    <div className="stack add-expense-page">
      <div className="card stack">
        <h2 className="title" style={{ fontSize: "1.1rem" }}>
          Add expense
        </h2>

        <div className="field">
          <label>Receipt (optional)</label>
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
            onChange={(e) => {
              void onPickReceipt(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(e) => {
              void onPickReceipt(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {ocrBusy ? (
            <p className="sub">Reading receipt… {ocrPct}%</p>
          ) : null}
          {receiptPreview ? (
            <img
              src={receiptPreview}
              alt="Receipt preview"
              style={{ width: "100%", borderRadius: 10, marginTop: 8 }}
            />
          ) : null}
        </div>

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
            placeholder={
              minorUnitsFor(currency) === 1 ? "e.g. 2480" : "e.g. 12.50"
            }
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

        <button
          className="btn btn-lg"
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          Save expense
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => nav(`/trip/${trip.id}/balance`)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
