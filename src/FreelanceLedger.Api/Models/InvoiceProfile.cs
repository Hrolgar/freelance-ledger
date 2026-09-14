namespace FreelanceLedger.Api.Models;

/// Who the invoice is from and how to pay it. A single row, edited in Settings.
///
/// This lives in the DATABASE and never in the repository: it carries bank details,
/// and the repo is public. The live database sits behind Authentik.
public class InvoiceProfile
{
    public int Id { get; set; }

    // From block
    public string IssuerName { get; set; } = string.Empty;
    public string? IssuerAddressLine1 { get; set; }
    public string? IssuerAddressLine2 { get; set; }
    public string? IssuerCountry { get; set; }
    public string? IssuerEmail { get; set; }

    /// Organisation number, printed as its own line at the end of the From block
    /// when set. Optional -- blank prints nothing.
    public string? OrgNumber { get; set; }

    // Payment block
    public string? AccountHolder { get; set; }
    public string? BankName { get; set; }
    public string? Iban { get; set; }
    public string? BicSwift { get; set; }

    /// Free text under the payment table, e.g. the SHA transfer note.
    public string? PaymentNotes { get; set; }

    /// Why no VAT is charged. Printed verbatim.
    public string? VatNote { get; set; }

    /// Prefills the VAT rate on a new project. The per-project rate is what actually
    /// gets applied; this is only a default so it is typed once.
    public decimal? DefaultVatRate { get; set; }

    /// Default payment terms sentence, e.g. "Payment due on or about the 20th".
    public string? TermsNote { get; set; }
}
