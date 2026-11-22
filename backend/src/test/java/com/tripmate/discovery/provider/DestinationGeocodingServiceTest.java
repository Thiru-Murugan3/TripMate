package com.tripmate.discovery.provider;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DestinationGeocodingServiceTest {
    @Test void wayanaduUsesTheDistrictQueryForSearchAndSuggestions() {
        var provider=mock(GeocodingProvider.class);
        var district=new GeocodedDestination(new BigDecimal("11.7"),new BigDecimal("76.1"),"Wayanad, Kerala, India",null,"Wayanad","Kerala","IN","Test");
        when(provider.geocode("Wayanad, Kerala")).thenReturn(Optional.of(district));
        when(provider.suggest("Wayanad, Kerala",5)).thenReturn(List.of());
        var service=new DestinationGeocodingService(List.of(provider),24);
        assertEquals(district,service.geocode(" Wayanadu "));
        assertEquals(district,service.geocode("Wayanad"));
        verify(provider,times(1)).geocode("Wayanad, Kerala");
        service.suggest("Wayanadu",5);verify(provider).suggest("Wayanad, Kerala",5);
        verify(provider,never()).geocode("Wayanadu");
    }
}
