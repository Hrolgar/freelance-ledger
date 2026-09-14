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
    Paid,
    OnHold
}

public enum BillingType
{
    Fixed = 0,
    Hourly = 1,
    Retainer = 2
}

/// How often an hourly project's committed hours recur. None = purely ad-hoc logging.
public enum HoursCadence
{
    None = 0,
    Weekly = 1,
    Monthly = 2
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
    Other,
    Marketing
}

public enum InvestmentCategory
{
    Hardware = 0,
    Education = 1,
    Certification = 2,
    Equipment = 3,
    Other = 4
}
