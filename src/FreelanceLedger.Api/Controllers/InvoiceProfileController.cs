using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

/// Singleton: the "from" and payment blocks printed on every invoice. Kept in the
/// database rather than configuration because it holds bank details and the repo is
/// public.
[ApiController]
[Route("api/invoice-profile")]
public class InvoiceProfileController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var profile = await db.InvoiceProfiles.AsNoTracking().FirstOrDefaultAsync();
        return Ok(profile ?? new InvoiceProfile());
    }

    [HttpPut]
    public async Task<IActionResult> Upsert(InvoiceProfile updated)
    {
        var profile = await db.InvoiceProfiles.FirstOrDefaultAsync();
        if (profile is null)
        {
            profile = new InvoiceProfile();
            db.InvoiceProfiles.Add(profile);
        }

        profile.IssuerName = updated.IssuerName;
        profile.IssuerAddressLine1 = updated.IssuerAddressLine1;
        profile.IssuerAddressLine2 = updated.IssuerAddressLine2;
        profile.IssuerCountry = updated.IssuerCountry;
        profile.IssuerEmail = updated.IssuerEmail;
        profile.OrgNumber = updated.OrgNumber;
        profile.AccountHolder = updated.AccountHolder;
        profile.BankName = updated.BankName;
        profile.Iban = updated.Iban;
        profile.BicSwift = updated.BicSwift;
        profile.PaymentNotes = updated.PaymentNotes;
        profile.VatNote = updated.VatNote;
        profile.TermsNote = updated.TermsNote;
        profile.DefaultVatRate = updated.DefaultVatRate;

        await db.SaveChangesAsync();
        return Ok(profile);
    }
}
