import React, { useState } from "react";
import { Calculator, Gauge, CircleDot, Link2, Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const TAB_IDS = [
  ["steps", "Steps/mm", Gauge, "steps"],
  ["extruder", "Extrudeur", CircleDot, "extruder"],
  ["belt", "Courroie", Link2, "belt"],
  ["leadscrew", "Vis", Wrench, "leadscrew"],
];

export default function Calculators() {
  const { t } = useI18n();
  const [tab, setTab] = useState("steps");
  const tabs = TAB_IDS.map(([id, fallback, icon, key]) => ({ id, label: t(`calculator.${key}`) || fallback, icon }));
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold mb-4 flex items-center gap-2"><Calculator className="w-5 h-5" /> {t("calculator.title")}</h1>
        <div className="flex gap-1 mb-4 border-b border-border">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 ${tab === t.id ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
        {tab === "steps" && <StepsCalc />}
        {tab === "extruder" && <ExtruderCalc />}
        {tab === "belt" && <BeltCalc />}
        {tab === "leadscrew" && <LeadscrewCalc />}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, suffix }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background font-mono" />
        {suffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

function Result({ label, value, unit }) {
  return (
    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold font-mono">{value}<span className="text-sm text-muted-foreground ml-1">{unit}</span></div>
    </div>
  );
}

function StepsCalc() {
  const { t } = useI18n();
  const [steps, setSteps] = useState(200);
  const [micro, setMicro] = useState(16);
  const [pitch, setPitch] = useState(2);
  const [ratio, setRatio] = useState(1);
  const result = (steps * micro) / (pitch * ratio);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("calculator.screwDesc")}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("calculator.stepsPerTurn")} value={steps} onChange={setSteps} suffix="steps" />
        <Field label={t("calculator.microsteps")} value={micro} onChange={setMicro} suffix="x" />
        <Field label={t("calculator.screwPitch")} value={pitch} onChange={setPitch} suffix="mm" />
        <Field label={t("calculator.gearRatio")} value={ratio} onChange={setRatio} suffix=":1" />
      </div>
      <Result label={t("calculator.stepsResult")} value={result.toFixed(2)} unit="steps/mm" />
    </div>
  );
}

function ExtruderCalc() {
  const { t } = useI18n();
  const [steps, setSteps] = useState(200);
  const [micro, setMicro] = useState(16);
  const [dia, setDia] = useState(7);
  const [ratio, setRatio] = useState(3);
  const result = (steps * micro * ratio) / (Math.PI * dia);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("calculator.extruderDesc")}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("calculator.stepsPerTurn")} value={steps} onChange={setSteps} suffix="steps" />
        <Field label={t("calculator.microsteps")} value={micro} onChange={setMicro} suffix="x" />
        <Field label={t("calculator.gearDiameter")} value={dia} onChange={setDia} suffix="mm" />
        <Field label={t("calculator.gearRatio")} value={ratio} onChange={setRatio} suffix=":1" />
      </div>
      <Result label={t("calculator.extruderResult")} value={result.toFixed(2)} unit="steps/mm" />
    </div>
  );
}

function BeltCalc() {
  const { t } = useI18n();
  const [steps, setSteps] = useState(200);
  const [micro, setMicro] = useState(16);
  const [pitch, setPitch] = useState(2);
  const [teeth, setTeeth] = useState(20);
  const result = (steps * micro) / (pitch * teeth);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("calculator.beltDesc")}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("calculator.stepsPerTurn")} value={steps} onChange={setSteps} suffix="steps" />
        <Field label={t("calculator.microsteps")} value={micro} onChange={setMicro} suffix="x" />
        <Field label={t("calculator.beltPitch")} value={pitch} onChange={setPitch} suffix="mm" />
        <Field label={t("calculator.pulleyTeeth")} value={teeth} onChange={setTeeth} suffix="dents" />
      </div>
      <Result label={t("calculator.stepsResult")} value={result.toFixed(2)} unit="steps/mm" />
    </div>
  );
}

function LeadscrewCalc() {
  const { t } = useI18n();
  const [steps, setSteps] = useState(200);
  const [micro, setMicro] = useState(16);
  const [lead, setLead] = useState(8);
  const result = (steps * micro) / lead;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("calculator.leadscrewDesc")}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("calculator.stepsPerTurn")} value={steps} onChange={setSteps} suffix="steps" />
        <Field label={t("calculator.microsteps")} value={micro} onChange={setMicro} suffix="x" />
        <Field label={t("calculator.lead")} value={lead} onChange={setLead} suffix="mm/tr" />
      </div>
      <Result label={t("calculator.stepsResult")} value={result.toFixed(2)} unit="steps/mm" />
    </div>
  );
}