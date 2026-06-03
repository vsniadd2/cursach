FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ExpogoCrm.Api.csproj .
RUN dotnet restore ExpogoCrm.Api.csproj
COPY . .
RUN dotnet publish ExpogoCrm.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
RUN apt-get update \
    && apt-get install -y --no-install-recommends libfontconfig1 curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://0.0.0.0:5278
EXPOSE 5278
HEALTHCHECK --interval=5s --timeout=5s --retries=12 --start-period=20s \
  CMD curl -f http://127.0.0.1:5278/health || exit 1
ENTRYPOINT ["dotnet", "ExpogoCrm.Api.dll"]
