const Variant = require('../models/Variant');
const InventoryMovement = require('../models/InventoryMovement');

// Used within the SAME MongoDB transaction after a successful $inc.
// Works for sale, cancellation and payment callbacks without faking an admin actor.
const recordStockMovement = async ({ item, kind, delta, note, reference, session }) => {
  const current = await Variant.findById(item.variant).select('stock product').session(session);
  if (!current || !Number.isSafeInteger(delta) || !Number.isSafeInteger(current.stock - delta) || current.stock - delta < 0)
    throw new Error('STOCK_LEDGER_INCONSISTENT');
  await InventoryMovement.create([{ variant: item.variant, product: current.product, kind, delta, before: current.stock - delta, after: current.stock, note, reference: String(reference || '') }], { session });
};
module.exports = { recordStockMovement };
