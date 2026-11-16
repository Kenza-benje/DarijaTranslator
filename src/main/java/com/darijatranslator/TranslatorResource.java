
package com.darijatranslator;

import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonString;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.StringReader;

@Path("/translator")
public class TranslatorResource {

    @Inject
    GeminiService geminiService;

    @GET
    @Path("/hello")
    @Produces(MediaType.TEXT_PLAIN)
    public String hello() {
        return "Hello from Darija Translator!";
    }

    @POST
    @Path("/translate")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response translate(String body) {
        String text;
        if (body == null || body.isBlank()) {
            return error(400, "A JSON body with non-empty text is required.");
        }
        try (var reader = Json.createReader(new StringReader(body))) {
            JsonObject request = reader.readObject();
            if (!(request.get("text") instanceof JsonString value) || value.getString().isBlank()) {
                return error(400, "text must be a non-empty string.");
            }
            text = value.getString();
        } catch (RuntimeException e) {
            return error(400, "Invalid JSON object.");
        }
        try {
            return Response.ok(Json.createObjectBuilder()
                    .add("translation", geminiService.translate(text)).build().toString(),
                    MediaType.APPLICATION_JSON).build();
        } catch (GeminiService.TranslationException e) {
            return error(e.getStatus(), e.getMessage());
        }
    }

    private Response error(int status, String message) {
        return Response.status(status).type(MediaType.APPLICATION_JSON)
                .entity(Json.createObjectBuilder().add("error", message).build().toString()).build();
    }
}
