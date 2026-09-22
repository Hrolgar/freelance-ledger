namespace FreelanceLedger.Tests;

/// An HttpClient that never reaches the network. The dashboard endpoints fetch missing
/// exchange rates on demand, so a test that calls them with a real client would talk
/// to api.frankfurter.dev: slow, and green or red depending on the runner's network.
/// Every request fails as an HttpRequestException, which the service treats as
/// "provider down" and reports the month as missing.
public static class OfflineHttp
{
    public static HttpClient Client() => new(new RefusingHandler());

    private sealed class RefusingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => throw new HttpRequestException($"Tests are offline; refused {request.RequestUri}");
    }
}
