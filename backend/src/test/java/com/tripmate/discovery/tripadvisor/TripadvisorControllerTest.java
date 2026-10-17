package com.tripmate.discovery.tripadvisor;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TripadvisorControllerTest {
    @Test void paginatedSearchForwardsParametersAndIsNotCacheable() throws Exception {
        var service = mock(TripadvisorService.class);
        when(service.searchPage("Ooty", "attractions", 4, 4, "COMBINED")).thenReturn(new TripadvisorService.SearchPage(
                List.of(new TripadvisorService.Location("123", "Garden", "Ooty")), 4, 4, 14L, 4, false));
        var mvc = MockMvcBuilders.standaloneSetup(new TripadvisorController(service)).build();
        mvc.perform(get("/api/v1/discovery/tripadvisor/search-page").param("query", "Ooty").param("page", "4").param("size", "4"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.page").value(4)).andExpect(jsonPath("$.totalElements").value(14))
                .andExpect(jsonPath("$.hasNext").value(false)).andExpect(jsonPath("$.places[0].name").value("Garden"));
    }
    @Test void successfulAndFailedResponsesAreNotCacheable() throws Exception {
        var service = mock(TripadvisorService.class);
        when(service.search("Ooty", "attractions")).thenReturn(List.of(new TripadvisorService.Location("123", "Garden", "Ooty")));
        when(service.details("123")).thenThrow(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Limit reached"));
        var mvc=MockMvcBuilders.standaloneSetup(new TripadvisorController(service)).build();
        mvc.perform(get("/api/v1/discovery/tripadvisor/search").param("query", "Ooty"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$[0].name").value("Garden"));
        mvc.perform(get("/api/v1/discovery/tripadvisor/locations/123"))
                .andExpect(status().isTooManyRequests()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.code").value("USAGE_LIMIT"));
    }
}
