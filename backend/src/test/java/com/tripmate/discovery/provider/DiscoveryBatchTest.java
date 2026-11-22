package com.tripmate.discovery.provider;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import static org.junit.jupiter.api.Assertions.*;
class DiscoveryBatchTest {
 @Test void slowSourceCannotBlockHealthyPartialResults() {
  var release=new CountDownLatch(1);
  DiscoveryProvider slow=new DiscoveryProvider(){public String name(){return "Slow";}public DiscoveryProviderResult discover(DiscoveryProviderRequest r){try{release.await();}catch(InterruptedException ex){Thread.currentThread().interrupt();}return new DiscoveryProviderResult(name(),"",List.of(),List.of());}};
  DiscoveryProvider fast=new DiscoveryProvider(){public String name(){return "Fast";}public DiscoveryProviderResult discover(DiscoveryProviderRequest r){return new DiscoveryProviderResult(name(),"Attribution",List.of(),List.of());}};
  try {
   var result=DiscoveryBatch.fetch(List.of(slow,fast),null,Duration.ofMillis(300));
   assertTrue(result.get(0).value().warnings().getFirst().contains("time limit"));
   assertEquals("Attribution",result.get(1).value().attribution());
  } finally {release.countDown();}
 }
}
