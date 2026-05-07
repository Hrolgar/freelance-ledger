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
