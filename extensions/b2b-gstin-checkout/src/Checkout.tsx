import {
  reactExtension,
  useApplyAttributeChange,
  useAttributes,
  TextField,
  BlockStack,
  Checkbox,
  Banner,
  Text
} from "@shopify/ui-extensions-react/checkout";
import { useState, useCallback, useEffect } from "react";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export default reactExtension("purchase.checkout.block.render", () => <B2bGstinBlock />);

function B2bGstinBlock() {
  const applyAttributeChange = useApplyAttributeChange();
  const attributes = useAttributes();

  const [hasBusinessGst, setHasBusinessGst] = useState(false);
  const [gstin, setGstin] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sync existing attributes if returning to checkout
  useEffect(() => {
    const existingGstin = attributes?.find((a) => a.key === "gstin")?.value;
    const existingCompany = attributes?.find((a) => a.key === "company_name")?.value;

    if (existingGstin) {
      setHasBusinessGst(true);
      setGstin(existingGstin);
    }
    if (existingCompany) {
      setCompanyName(existingCompany);
    }
  }, [attributes]);

  const handleGstinChange = useCallback(
    async (value: string) => {
      const upper = value.trim().toUpperCase();
      setGstin(upper);

      if (upper.length === 0) {
        setError(null);
        await applyAttributeChange({
          type: "updateAttribute",
          key: "gstin",
          value: ""
        });
        return;
      }

      if (upper.length === 15) {
        if (!GSTIN_REGEX.test(upper)) {
          setError("Invalid 15-character GSTIN format (e.g. 27AABCA1234A1Z5)");
        } else {
          setError(null);
          await applyAttributeChange({
            type: "updateAttribute",
            key: "gstin",
            value: upper
          });
        }
      } else {
        setError("GSTIN must be exactly 15 characters");
      }
    },
    [applyAttributeChange]
  );

  const handleCompanyChange = useCallback(
    async (value: string) => {
      setCompanyName(value);
      await applyAttributeChange({
        type: "updateAttribute",
        key: "company_name",
        value: value.trim()
      });
    },
    [applyAttributeChange]
  );

  const handleToggle = useCallback(
    async (checked: boolean) => {
      setHasBusinessGst(checked);
      if (!checked) {
        setError(null);
        setGstin("");
        setCompanyName("");
        await applyAttributeChange({
          type: "updateAttribute",
          key: "gstin",
          value: ""
        });
        await applyAttributeChange({
          type: "updateAttribute",
          key: "company_name",
          value: ""
        });
      }
    },
    [applyAttributeChange]
  );

  return (
    <BlockStack spacing="loose">
      <Checkbox
        id="b2b-gstin-toggle"
        name="b2b-gstin-toggle"
        checked={hasBusinessGst}
        onChange={handleToggle}
      >
        Add Business GSTIN for input tax credit (Optional)
      </Checkbox>

      {hasBusinessGst && (
        <BlockStack spacing="tight">
          <TextField
            label="GSTIN (15-character GST number)"
            value={gstin}
            onChange={handleGstinChange}
            error={error || undefined}
            maxLength={15}
          />
          <TextField
            label="Registered Company / Legal Business Name"
            value={companyName}
            onChange={handleCompanyChange}
          />
          {gstin.length === 15 && !error && (
            <Banner status="success">
              <Text size="small">
                GSTIN verified. A B2B Tax Invoice eligible for Input Tax Credit (ITC) will be issued.
              </Text>
            </Banner>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
}
