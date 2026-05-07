namespace FreelanceLedger.Api.Models;

public enum Currency
{
    GBP,
    USD,
    EUR,
    CAD,
    INR,
    NOK
}

public enum ProjectStatus
{
    Quoted,
    Awarded,
    InProgress,
    Completed,
    Paid
}

public enum MilestoneStatus
{
    Pending,
    Funded,
    Released,
    Paid,
    Disputed
}

public enum CostCategory
{
    Software,
    Hardware,
    Internet,
    Office,
    Other
}
