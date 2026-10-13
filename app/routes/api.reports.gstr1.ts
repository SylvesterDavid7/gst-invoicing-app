import { type LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "../db.server";
import { generateGstr1Excel } from "../services/gstr1/gstr1-exporter.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const month = parseInt(url.searchParams.get("month") || "10", 10);
  const year = parseInt(url.searchParams.get("year") || "2026", 10);

  const store = await prisma.store.findFirst();

  if (!store) {
    return new Response("Store not found in database", { status: 404 });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const excelBuffer = await generateGstr1Excel({
    storeId: store.id,
    startDate,
    endDate
  });

  const filename = `GSTR1_${store.gstin}_${String(month).padStart(2, "0")}${year}.xlsx`;

  return new Response(Buffer.from(excelBuffer as ArrayBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
