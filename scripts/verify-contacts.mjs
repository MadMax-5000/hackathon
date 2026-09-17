import { makeReporter } from "./harness.mjs";
import { createDbStore } from "./db-harness.mjs";
import { availableChannels, channelLabel, preferredChannels } from "../src/engine/contact.ts";

const { check, finish } = makeReporter("CUSTOMER CONTACTS");

console.log("\n[1] Channel availability is read from the customer database");
{
  const { store, cleanup } = createDbStore();
  const ws = store.getWorkspace();
  const byId = Object.fromEntries(ws.customers.map((customer) => [customer.id, customer]));

  const cus1 = availableChannels(byId["CUS-1"]);
  check("1a  CUS-1 has WhatsApp", cus1.includes("whatsapp"), cus1.join(","));
  check("1b  CUS-1 has Email", cus1.includes("email"), cus1.join(","));
  check("1c  CUS-1 has Phone", cus1.includes("phone"), cus1.join(","));
  check("1d  CUS-1 has no SMS", !cus1.includes("sms"), cus1.join(","));
  check("1e  CUS-1 preferred channel is WhatsApp", byId["CUS-1"].preferredChannel === "whatsapp", byId["CUS-1"].preferredChannel);

  const cus4 = availableChannels(byId["CUS-4"]);
  check("1f  CUS-4 has Email and Phone", cus4.includes("email") && cus4.includes("phone"), cus4.join(","));
  check("1g  CUS-4 has no WhatsApp", !cus4.includes("whatsapp"), cus4.join(","));
  check("1h  CUS-4 preferred channel is Email", byId["CUS-4"].preferredChannel === "email", byId["CUS-4"].preferredChannel);

  const { preferred } = preferredChannels(byId["CUS-1"], cus1);
  check("1i  preferred channel resolves within available list", preferred === "whatsapp", preferred);
  cleanup();
}

console.log("\n[2] Missing contact stays missing — nothing is fabricated");
{
  const { store, cleanup } = createDbStore();
  const ws = store.getWorkspace();
  const cus2 = ws.customers.find((customer) => customer.id === "CUS-2");
  check("2a  CUS-2 phone is null", cus2.phone === null, String(cus2.phone));
  check("2b  CUS-2 whatsapp is null", cus2.whatsapp === null, String(cus2.whatsapp));
  check("2c  CUS-2 email is null", cus2.email === null, String(cus2.email));
  check("2d  CUS-2 has no available channels", availableChannels(cus2).length === 0, availableChannels(cus2).join(","));
  check("2e  CUS-2 has no preferred channel", cus2.preferredChannel === null, String(cus2.preferredChannel));

  const ty2 = ws.source.wheel_sets.find((wheel) => wheel.id === "TY-2");
  check("2f  TY-2 source contact status is missing", ty2.contact === "missing", ty2.contact);
  cleanup();
}

console.log("\n[3] Every seeded channel is a clearly synthetic value");
{
  const { store, cleanup } = createDbStore();
  const ws = store.getWorkspace();
  const values = [];
  for (const customer of ws.customers) {
    for (const value of [customer.phone, customer.whatsapp, customer.email]) {
      if (value) values.push(value);
    }
  }
  check("3a  emails use example.invalid", values.filter((v) => v.includes("@")).every((v) => v.endsWith("@example.invalid")));
  check("3b  phones use the synthetic 555 range", values.filter((v) => !v.includes("@")).every((v) => v.includes("555")));
  cleanup();
}

console.log("\n[4] Channel helper labels are stable");
{
  check("4a  whatsapp label", channelLabel("whatsapp") === "WhatsApp");
  check("4b  phone label", channelLabel("phone") === "Call");
  check("4c  sms label", channelLabel("sms") === "SMS");
}

process.exit(finish());
