package com.tripmate.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripmate.booking.BookingStatus;
import com.tripmate.booking.BookingType;
import com.tripmate.booking.CreateBookingRequest;
import com.tripmate.booking.TransportType;
import com.tripmate.expense.CreateExpenseRequest;
import com.tripmate.expense.ExpenseCategory;
import com.tripmate.itinerary.CreateItineraryDayRequest;
import com.tripmate.itinerary.CreateItineraryItemRequest;
import com.tripmate.member.AddMemberRequest;
import com.tripmate.member.TripRole;
import com.tripmate.place.CreatePlaceRequest;
import com.tripmate.place.PlaceCategory;
import com.tripmate.trip.CreateTripRequest;
import com.tripmate.trip.TripStatus;
import com.tripmate.trip.TripType;
import com.tripmate.trip.UpdateTripRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TripMateE2EIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("E2E Journey: Register -> Login -> Trip Lifecycle -> Members -> Places -> Itinerary -> Expense -> Booking -> Document -> Dashboard -> Logout")
    void fullUserJourney_E2E_Success() throws Exception {

        // 1. REGISTER OWNER USER
        String ownerRegisterJson = """
                {
                    "name": "Alice Owner",
                    "email": "alice.owner@example.com",
                    "mobile": "9876543210",
                    "password": "Password@123"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ownerRegisterJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("alice.owner@example.com"));

        // 2. REGISTER TRAVELER USER (For member invitation test)
        String travelerRegisterJson = """
                {
                    "name": "Bob Traveler",
                    "email": "bob.traveler@example.com",
                    "mobile": "9876543211",
                    "password": "Password@123"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(travelerRegisterJson))
                .andExpect(status().isCreated());

        // 3. LOGIN OWNER
        String ownerLoginJson = """
                {
                    "email": "alice.owner@example.com",
                    "password": "Password@123"
                }
                """;

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ownerLoginJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andReturn();

        String token = objectMapper.readTree(loginResult.getResponse().getContentAsString()).get("accessToken").asText();
        String authHeader = "Bearer " + token;

        // 4. CREATE TRIP
        CreateTripRequest createTripReq = new CreateTripRequest(
                "Manali Expedition",
                "Manali, HP",
                TripType.FRIENDS,
                LocalDate.now().plusDays(5),
                LocalDate.now().plusDays(12),
                4,
                new BigDecimal("25000.00"),
                "Summer mountain getaway",
                null
        );

        MvcResult createTripResult = mockMvc.perform(post("/api/v1/trips")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createTripReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Manali Expedition"))
                .andReturn();

        Long tripId = objectMapper.readTree(createTripResult.getResponse().getContentAsString()).get("id").asLong();

        // 5. GET TRIP BY ID
        mockMvc.perform(get("/api/v1/trips/{tripId}", tripId)
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tripId))
                .andExpect(jsonPath("$.destination").value("Manali, HP"));

        // 6. ADD TRAVELER MEMBER (EDITOR)
        AddMemberRequest addMemberReq = new AddMemberRequest("bob.traveler@example.com", TripRole.EDITOR);

        mockMvc.perform(post("/api/v1/trips/{tripId}/members", tripId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addMemberReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userEmail").value("bob.traveler@example.com"))
                .andExpect(jsonPath("$.role").value("EDITOR"));

        // 7. ADD PLACE
        CreatePlaceRequest placeReq = new CreatePlaceRequest(
                "Solang Valley",
                PlaceCategory.ATTRACTION,
                new BigDecimal("32.3166"),
                new BigDecimal("77.1558"),
                new BigDecimal("1200.00"),
                "Adventure sports location"
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/places", tripId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(placeReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Solang Valley"));

        // 8. ADD ITINERARY DAY & ITEM
        CreateItineraryDayRequest dayReq = new CreateItineraryDayRequest(
                1,
                LocalDate.now().plusDays(5),
                "Arrival & Sightseeing",
                "Check into hotel first"
        );

        MvcResult dayResult = mockMvc.perform(post("/api/v1/trips/{tripId}/itinerary/days", tripId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dayReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.dayNumber").value(1))
                .andReturn();

        Long dayId = objectMapper.readTree(dayResult.getResponse().getContentAsString()).get("id").asLong();

        CreateItineraryItemRequest itemReq = new CreateItineraryItemRequest(
                null,
                "Check-in at Snow Valley Resort",
                "Resort Checkin",
                LocalTime.of(12, 0),
                LocalTime.of(13, 0),
                "Snow Valley, Manali",
                new BigDecimal("0.00"),
                1
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/itinerary/days/{dayId}/items", tripId, dayId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(itemReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Check-in at Snow Valley Resort"));

        // 9. ADD EXPENSE
        CreateExpenseRequest expenseReq = new CreateExpenseRequest(
                "Hotel Booking Advance",
                new BigDecimal("8500.00"),
                ExpenseCategory.HOTEL,
                LocalDate.now().plusDays(1),
                null,
                null,
                null,
                "Paid via UPI"
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/expenses", tripId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(expenseReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Hotel Booking Advance"))
                .andExpect(jsonPath("$.amount").value(8500.00));

        // 10. ADD TRANSPORT BOOKING
        CreateBookingRequest bookingReq = new CreateBookingRequest(
                BookingType.TRANSPORT,
                TransportType.TRAIN,
                "Indian Railways",
                "PNR987654321",
                "Delhi Junction",
                "Chandigarh",
                LocalDateTime.now().plusDays(5).withHour(6),
                LocalDateTime.now().plusDays(5).withHour(11),
                new BigDecimal("1450.00"),
                BookingStatus.CONFIRMED,
                "Sleeper Class"
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/bookings", tripId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(bookingReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bookingType").value("TRANSPORT"))
                .andExpect(jsonPath("$.transportType").value("TRAIN"));

        // 11. UPLOAD DOCUMENT
        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "train_ticket.pdf",
                MediaType.APPLICATION_PDF_VALUE,
                "Mock PDF ticket content".getBytes()
        );

        mockMvc.perform(multipart("/api/v1/trips/{tripId}/documents", tripId)
                        .file(mockFile)
                        .param("documentType", "TRAIN_TICKET")
                        .header("Authorization", authHeader))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileName").value("train_ticket.pdf"));

        // 12. GET DASHBOARD
        mockMvc.perform(get("/api/v1/trips/{tripId}/dashboard", tripId)
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tripId").value(tripId))
                .andExpect(jsonPath("$.tripName").value("Manali Expedition"))
                .andExpect(jsonPath("$.budget").value(25000.00));

        // 13. GET NOTIFICATIONS
        mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk());

        // 14. UPDATE TRIP
        UpdateTripRequest updateTripReq = new UpdateTripRequest(
                "Manali Expedition 2026",
                "Manali & Solang, HP",
                TripType.FRIENDS,
                LocalDate.now().plusDays(5),
                LocalDate.now().plusDays(12),
                5,
                new BigDecimal("30000.00"),
                "Updated budget & scope",
                null,
                TripStatus.PLANNED
        );

        mockMvc.perform(put("/api/v1/trips/{tripId}", tripId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateTripReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Manali Expedition 2026"))
                .andExpect(jsonPath("$.budget").value(30000.00));

        // 15. LOGOUT
        String logoutJson = """
                {
                    "refreshToken": "sample-refresh-token"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/logout")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(logoutJson))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Security & Negative Scenarios Validation")
    void securityAndNegativeScenarios_Validation() throws Exception {

        // 1. NO JWT -> 401 UNAUTHORIZED
        mockMvc.perform(get("/api/v1/trips"))
                .andExpect(status().isUnauthorized());

        // REGISTER & LOGIN AS NORMAL USER
        String userRegister = """
                {
                    "name": "Normal User",
                    "email": "normal.user@example.com",
                    "mobile": "9876543212",
                    "password": "Password@123"
                }
                """;
        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(userRegister))
                .andExpect(status().isCreated());

        String userLogin = """
                {
                    "email": "normal.user@example.com",
                    "password": "Password@123"
                }
                """;
        MvcResult userLoginRes = mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(userLogin))
                .andExpect(status().isOk()).andReturn();

        String userToken = objectMapper.readTree(userLoginRes.getResponse().getContentAsString()).get("accessToken").asText();
        String userAuthHeader = "Bearer " + userToken;

        // 2. NORMAL USER ACCESSING ADMIN API -> 403 FORBIDDEN
        mockMvc.perform(get("/api/v1/admin/users")
                        .header("Authorization", userAuthHeader))
                .andExpect(status().isForbidden());

        // REGISTER OWNER & VIEWER
        String ownerRegister = """
                {
                    "name": "Trip Owner",
                    "email": "owner.trip@example.com",
                    "mobile": "9876543213",
                    "password": "Password@123"
                }
                """;
        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(ownerRegister))
                .andExpect(status().isCreated());

        String ownerLogin = """
                {
                    "email": "owner.trip@example.com",
                    "password": "Password@123"
                }
                """;
        MvcResult ownerLoginRes = mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(ownerLogin))
                .andExpect(status().isOk()).andReturn();
        String ownerToken = objectMapper.readTree(ownerLoginRes.getResponse().getContentAsString()).get("accessToken").asText();
        String ownerAuthHeader = "Bearer " + ownerToken;

        // OWNER CREATES TRIP
        CreateTripRequest createTrip = new CreateTripRequest(
                "Goa Weekend", "Goa", TripType.FRIENDS,
                LocalDate.now().plusDays(2), LocalDate.now().plusDays(4),
                2, new BigDecimal("10000.00"), "Notes", null
        );
        MvcResult tripRes = mockMvc.perform(post("/api/v1/trips")
                        .header("Authorization", ownerAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createTrip)))
                .andExpect(status().isCreated()).andReturn();
        Long tripId = objectMapper.readTree(tripRes.getResponse().getContentAsString()).get("id").asLong();

        // OWNER ADDS NORMAL USER AS VIEWER
        AddMemberRequest addViewer = new AddMemberRequest("normal.user@example.com", TripRole.VIEWER);
        mockMvc.perform(post("/api/v1/trips/{tripId}/members", tripId)
                        .header("Authorization", ownerAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addViewer)))
                .andExpect(status().isCreated());

        // 3. VIEWER EDIT ATTEMPT -> 403 FORBIDDEN
        CreatePlaceRequest viewerPlaceReq = new CreatePlaceRequest(
                "Forbidden Place", PlaceCategory.ATTRACTION, null, null, BigDecimal.ZERO, null
        );
        mockMvc.perform(post("/api/v1/trips/{tripId}/places", tripId)
                        .header("Authorization", userAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(viewerPlaceReq)))
                .andExpect(status().isForbidden());

        // 4. INVALID TRIP ID -> 404 NOT FOUND
        mockMvc.perform(get("/api/v1/trips/{tripId}", 99999L)
                        .header("Authorization", ownerAuthHeader))
                .andExpect(status().isNotFound());

        // 5. INVALID TRIP DATES (end date before start date) -> 400 BAD REQUEST
        CreateTripRequest invalidDatesReq = new CreateTripRequest(
                "Invalid Trip", "Goa", TripType.SOLO,
                LocalDate.now().plusDays(10), LocalDate.now().plusDays(5),
                1, new BigDecimal("5000.00"), "Invalid dates", null
        );
        mockMvc.perform(post("/api/v1/trips")
                        .header("Authorization", ownerAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDatesReq)))
                .andExpect(status().isBadRequest());

        // 6. INVALID TRANSPORT BOOKING (TRANSPORT type with transportType = null) -> 400 BAD REQUEST
        CreateBookingRequest invalidBookingReq = new CreateBookingRequest(
                BookingType.TRANSPORT,
                null, // Missing transportType for TRANSPORT booking
                "Indian Railways",
                "PNR123",
                "Delhi",
                "Agra",
                LocalDateTime.now().plusDays(2),
                LocalDateTime.now().plusDays(2).plusHours(3),
                new BigDecimal("500.00"),
                BookingStatus.CONFIRMED,
                null
        );
        mockMvc.perform(post("/api/v1/trips/{tripId}/bookings", tripId)
                        .header("Authorization", ownerAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidBookingReq)))
                .andExpect(status().isBadRequest());
    }
}
