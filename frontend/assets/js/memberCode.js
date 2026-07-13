/**
 * Shared EAN-13 member barcode helpers for POS + customers pages.
 */
(function attachMemberCode(window) {
    const MEMBER_EAN13_PREFIX = "29";
    const MEMBER_ID_DIGITS = 10;

    function calculateEan13CheckDigit(body) {
        if (!/^\d{12}$/.test(body)) {
            return null;
        }
        const total = body.split("").reduce((sum, digit, index) => {
            const value = Number(digit);
            return sum + (index % 2 === 0 ? value : value * 3);
        }, 0);
        return String((10 - (total % 10)) % 10);
    }

    function generateMemberCode(customerId) {
        const numericId = Number(customerId);
        if (!Number.isSafeInteger(numericId) || numericId < 0) {
            return null;
        }
        const paddedId = String(numericId).padStart(MEMBER_ID_DIGITS, "0");
        if (paddedId.length > MEMBER_ID_DIGITS) {
            return null;
        }
        const body = `${MEMBER_EAN13_PREFIX}${paddedId}`;
        const check = calculateEan13CheckDigit(body);
        return check == null ? null : `${body}${check}`;
    }

    function normalizeMemberBarcodeInput(value) {
        return String(value || "")
            .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10))
            .replace(/\D+/g, "");
    }

    function isValidEan13MemberCode(memberCode) {
        const code = normalizeMemberBarcodeInput(memberCode);
        return /^\d{13}$/.test(code)
            && code.startsWith(MEMBER_EAN13_PREFIX)
            && calculateEan13CheckDigit(code.slice(0, -1)) === code.at(-1);
    }

    window.MEMBER_EAN13_PREFIX = MEMBER_EAN13_PREFIX;
    window.calculateEan13CheckDigit = calculateEan13CheckDigit;
    window.generateMemberCode = generateMemberCode;
    window.normalizeMemberBarcodeInput = normalizeMemberBarcodeInput;
    window.isValidEan13MemberCode = isValidEan13MemberCode;
})(window);
