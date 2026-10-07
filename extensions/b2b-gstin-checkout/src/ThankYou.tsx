import {
  reactExtension,
  useOrder,
  useAttributes,
  BlockStack,
  View,
  Heading,
  Text,
  Button,
  InlineStack,
  Banner
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.thank-you.block.render", () => <ThankYouInvoiceBlock />);

function ThankYouInvoiceBlock() {
  const order = useOrder();
  const attributes = useAttributes();

  if (!order) {
    return null;
  }

  // Check if buyer provided GSTIN in checkout attributes
  const gstinAttr = attributes?.find(
    (attr) => attr.key === "gstin" || attr.key === "business_gstin"
  )?.value;

  const downloadUrl = `/api/invoices/download?order_id=${order.id}`;

  return (
    <View
      border="base"
      borderRadius="base"
      padding="base"
    >
      <BlockStack spacing="tight">
        <InlineStack alignment="space-between">
          <Heading level={2}>📄 GST Tax Invoice</Heading>
        </InlineStack>

        <Text size="small" appearance="subdued">
          Your official GST tax invoice is generated and attached to this order.
        </Text>

        {gstinAttr && (
          <Banner status="success">
            <Text size="small">
              Eligible for Input Tax Credit under GSTIN: <strong>{gstinAttr}</strong>
            </Text>
          </Banner>
        )}

        <Button
          kind="secondary"
          to={downloadUrl}
          external
        >
          ⬇ Download Tax Invoice (PDF)
        </Button>
      </BlockStack>
    </View>
  );
}
