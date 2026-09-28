export type PersonalizationRecord = {
  path: string;
  title: string;
  type: "Signal" | "Pattern" | "Hypothesis";
  liked: boolean;
  saved: boolean;
  shared: boolean;
  updatedAt: string;
};

const storageKey = "ai-intelligence-personalization";
const eventName = "ai-intelligence-personalization-updated";

export function readPersonalization(): PersonalizationRecord[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as PersonalizationRecord[]; } catch { return []; }
}

export function updatePersonalization(record: Omit<PersonalizationRecord, "liked" | "saved" | "shared" | "updatedAt">, update: Partial<Pick<PersonalizationRecord, "liked" | "saved" | "shared">>) {
  const records = readPersonalization();
  const existing = records.find((item) => item.path === record.path);
  const next: PersonalizationRecord = { ...existing, ...record, liked: false, saved: false, shared: false, ...update, updatedAt: new Date().toISOString() };
  const nextRecords = [...records.filter((item) => item.path !== record.path), next];
  window.localStorage.setItem(storageKey, JSON.stringify(nextRecords));
  window.dispatchEvent(new Event(eventName));
  return next;
}

export { eventName as personalizationEventName };
