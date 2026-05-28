package com.aercs.service;

import com.aercs.exception.BadRequestException;
import com.aercs.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SupabaseStorageService {

    @Value("${app.supabase.url}")
    private String supabaseUrl;

    @Value("${app.supabase.service-role-key}")
    private String serviceRoleKey;

    @Value("${app.supabase.storage-bucket}")
    private String bucket;

    private final RestTemplate restTemplate;

    public void upload(String objectPath, byte[] bytes, String contentType) {
        String url = supabaseUrl + "/storage/v1/object/" + bucket + "/" + objectPath;
        HttpHeaders headers = authHeaders();
        headers.setContentType(MediaType.parseMediaType(contentType));
        headers.set("x-upsert", "true");

        try {
            restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(bytes, headers), String.class);
        } catch (Exception e) {
            throw new BadRequestException("Unable to store evidence file");
        }
    }

    public byte[] download(String objectPath) {
        String url = supabaseUrl + "/storage/v1/object/authenticated/" + bucket + "/" + objectPath;
        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(authHeaders()), byte[].class);
            byte[] body = response.getBody();
            if (body == null) {
                throw new ResourceNotFoundException("Evidence file not found");
            }
            return body;
        } catch (HttpClientErrorException.NotFound e) {
            throw new ResourceNotFoundException("Evidence file not found");
        } catch (ResourceNotFoundException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("Unable to read evidence file");
        }
    }

    public void delete(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) return;
        String url = supabaseUrl + "/storage/v1/object/" + bucket;
        HttpHeaders headers = authHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, List<String>> body = Map.of("prefixes", List.of(objectPath));
        try {
            restTemplate.exchange(url, HttpMethod.DELETE, new HttpEntity<>(body, headers), String.class);
        } catch (Exception e) {
            // deletion failure should not block the caller
        }
    }

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + serviceRoleKey);
        return headers;
    }
}
