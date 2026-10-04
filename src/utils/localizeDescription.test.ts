/* eslint-disable import/no-named-as-default-member -- i18n is the shared i18next instance */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import i18n from "i18next";
import en from "@/i18n/locales/en";
import pt from "@/i18n/locales/pt";
import es from "@/i18n/locales/es";
import { localizeDescription } from "./localizeDescription";

before(async () => {
  await i18n.init({
    lng: "en",
    fallbackLng: "en",
    resources: {
      en: { translation: en },
      pt: { translation: pt },
      es: { translation: es },
    },
    interpolation: { escapeValue: false },
  });
});

const render = (lng: "en" | "pt" | "es", locale: string, description: string) =>
  localizeDescription(description, i18n.getFixedT(lng), locale);

test("weekly description with shift counts", () => {
  const d = "Semana de 03/10/2026 a 09/10/2026 (1 Dia, 3 Noites)";
  assert.equal(render("en", "en-US", d), "Week of 10/3/2026 to 10/9/2026 (1 Day, 3 Nights)");
  assert.equal(render("es", "es-ES", d), "Semana del 3/10/2026 al 9/10/2026 (1 Día, 3 Noches)");
  assert.equal(render("pt", "pt-BR", d), d);
});

test("half-month, month and extra descriptions", () => {
  assert.equal(render("en", "en-US", "2ª Quinzena de outubro de 2026"), "2nd half of October 2026");
  assert.equal(render("es", "es-ES", "março de 2026 (4 Dias)"), "marzo de 2026 (4 Días)");
  assert.equal(render("en", "en-US", "Extra Noite - 05/10/2026"), "Extra Night - 10/5/2026");
});

test("unknown formats are returned untouched", () => {
  assert.equal(render("en", "en-US", "Pagamento manual"), "Pagamento manual");
});
