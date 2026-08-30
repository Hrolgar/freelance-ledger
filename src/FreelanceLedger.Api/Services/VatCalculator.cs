namespace FreelanceLedger.Api.Services;

/// VAT is computed once, at invoice-raise time, from the project's VatRate and the
/// invoice's net Amount, and stored on the milestone. Never recomputed at render time
/// or on the way out of the API -- a second rounding of an already-rounded figure is
/// how a total stops adding up. Shared by the hourly sweep and the retainer raise so
/// the two cannot compute it differently.
public static class VatCalculator
{
    public static decimal? Amount(decimal netAmount, decimal? vatRate) =>
        vatRate is { } r
            ? Math.Round(netAmount * r / 100m, 2, MidpointRounding.AwayFromZero)
            : null;
}
