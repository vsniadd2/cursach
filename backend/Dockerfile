FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ExpogoCrm.Api.csproj .
RUN dotnet restore ExpogoCrm.Api.csproj
COPY . .
RUN dotnet publish ExpogoCrm.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://0.0.0.0:5278
EXPOSE 5278
ENTRYPOINT ["dotnet", "ExpogoCrm.Api.dll"]
