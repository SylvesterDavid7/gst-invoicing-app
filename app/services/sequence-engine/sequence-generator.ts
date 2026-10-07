/**
 * Calculates current Indian Financial Year (April 1 to March 31)
 * e.g., for May 2026 -> "26-27"; for February 2027 -> "26-27"; for April 2027 -> "27-28"
 */
export function getCurrentIndianFiscalYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed: 0 = Jan, 3 = April

  const isAprilOrLater = month >= 3;
  const startYear = isAprilOrLater ? year : year - 1;
  const endYear = isAprilOrLater ? year + 1 : year;

  const startStr = startYear.toString().slice(-2);
  const endStr = endYear.toString().slice(-2);

  return `${startStr}-${endStr}`;
}

export interface NextInvoiceNumberResult {
  invoiceNumber: string;
  fiscalYear: string;
  sequence: number;
}

export interface NextCreditNoteNumberResult {
  creditNoteNumber: string;
  fiscalYear: string;
  sequence: number;
}

/**
 * Generates the next sequential invoice number within an ACID transaction
 * using PostgreSQL row-level locking (SELECT ... FOR UPDATE) to guarantee zero collisions.
 */
export async function getNextInvoiceNumber(
  tx: any, // Prisma Transaction Client
  storeId: string
): Promise<NextInvoiceNumberResult> {
  const currentFy = getCurrentIndianFiscalYear();

  // Acquire row-level lock on the Store record using raw query
  const lockedStores = (await tx.$queryRawUnsafe(
    `SELECT "id", "invoicePrefix", "currentFiscalYear", "invoiceSequence" 
     FROM "Store" 
     WHERE "id" = $1 
     FOR UPDATE`,
    storeId
  )) as any[];

  if (!lockedStores || lockedStores.length === 0) {
    throw new Error(`Store with id ${storeId} not found for row lock`);
  }

  const store = lockedStores[0];
  let nextSeq: number;
  let activeFy: string = store.currentFiscalYear;

  // Fiscal Year Rollover Check (reset on April 1st)
  if (activeFy !== currentFy) {
    activeFy = currentFy;
    nextSeq = 1;
  } else {
    nextSeq = (store.invoiceSequence || 0) + 1;
  }

  // Update store sequence atomically
  await tx.$executeRawUnsafe(
    `UPDATE "Store" 
     SET "invoiceSequence" = $1, "currentFiscalYear" = $2, "updatedAt" = NOW() 
     WHERE "id" = $3`,
    nextSeq,
    activeFy,
    storeId
  );

  const prefix = store.invoicePrefix || "INV";
  const paddedSeq = String(nextSeq).padStart(4, "0");
  const formattedInvoiceNo = `${prefix}/${activeFy}/${paddedSeq}`;

  return {
    invoiceNumber: formattedInvoiceNo,
    fiscalYear: activeFy,
    sequence: nextSeq
  };
}

/**
 * Generates next consecutive Credit Note number (Rule 53 of CGST Rules)
 */
export async function getNextCreditNoteNumber(
  tx: any,
  storeId: string
): Promise<NextCreditNoteNumberResult> {
  const currentFy = getCurrentIndianFiscalYear();

  const lockedStores = (await tx.$queryRawUnsafe(
    `SELECT "id", "creditNotePrefix", "currentFiscalYear", "creditSequence" 
     FROM "Store" 
     WHERE "id" = $1 
     FOR UPDATE`,
    storeId
  )) as any[];

  if (!lockedStores || lockedStores.length === 0) {
    throw new Error(`Store with id ${storeId} not found for row lock`);
  }

  const store = lockedStores[0];
  let nextSeq: number;
  let activeFy: string = store.currentFiscalYear;

  if (activeFy !== currentFy) {
    activeFy = currentFy;
    nextSeq = 1;
  } else {
    nextSeq = (store.creditSequence || 0) + 1;
  }

  await tx.$executeRawUnsafe(
    `UPDATE "Store" 
     SET "creditSequence" = $1, "currentFiscalYear" = $2, "updatedAt" = NOW() 
     WHERE "id" = $3`,
    nextSeq,
    activeFy,
    storeId
  );

  const prefix = store.creditNotePrefix || "CN";
  const paddedSeq = String(nextSeq).padStart(4, "0");
  const formattedCreditNoteNo = `${prefix}/${activeFy}/${paddedSeq}`;

  return {
    creditNoteNumber: formattedCreditNoteNo,
    fiscalYear: activeFy,
    sequence: nextSeq
  };
}
