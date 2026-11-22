package com.tripmate.discovery.provider;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

/** Bounded shared workers. A slow source cannot add its timeout to every other source. */
public final class DiscoveryBatch {
    private static final ThreadPoolExecutor POOL = new ThreadPoolExecutor(6,6,30,TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(32), task -> {var t=new Thread(task,"suttru-discovery");t.setDaemon(true);return t;},new ThreadPoolExecutor.AbortPolicy());
    private static final ThreadPoolExecutor FALLBACK = new ThreadPoolExecutor(2,2,30,TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(8),task->{var t=new Thread(task,"suttru-fallback");t.setDaemon(true);return t;},new ThreadPoolExecutor.AbortPolicy());
    public static List<Result> fallback(List<DiscoveryProvider> providers,DiscoveryProviderRequest request,Duration budget) {return fetchOn(FALLBACK,providers,request,budget);}
    public record Result(DiscoveryProvider provider, DiscoveryProviderResult value) {}
    public static List<Result> fetch(List<DiscoveryProvider> providers, DiscoveryProviderRequest request, Duration budget) {
        return fetchOn(POOL,providers,request,budget);
    }
    private static List<Result> fetchOn(ThreadPoolExecutor pool,List<DiscoveryProvider> providers,DiscoveryProviderRequest request,Duration budget) {
        var completion=new ExecutorCompletionService<Result>(pool);
        var pending=new LinkedHashMap<Future<Result>,DiscoveryProvider>();
        var completed=new HashMap<DiscoveryProvider,DiscoveryProviderResult>();
        long deadline=System.nanoTime()+budget.toNanos();
        for(var provider:providers) {
            try {pending.put(completion.submit(()->new Result(provider,provider.discover(request))),provider);}
            catch(RejectedExecutionException ex) {completed.put(provider,unavailable(provider));}
        }
        try {
            while(!pending.isEmpty()) {
                long remaining=deadline-System.nanoTime();if(remaining<=0)break;
                var future=completion.poll(remaining,TimeUnit.NANOSECONDS);if(future==null)break;
                var provider=pending.remove(future);if(provider==null)continue;
                try {completed.put(provider,future.get().value());}
                catch(ExecutionException|CancellationException ex) {completed.put(provider,unavailable(provider));}
            }
        } catch(InterruptedException ex) {Thread.currentThread().interrupt();}
        finally {pending.forEach((future,provider)->{future.cancel(true);completed.put(provider,unavailable(provider));});pool.purge();}
        return providers.stream().map(provider->new Result(provider,completed.getOrDefault(provider,unavailable(provider)))).toList();
    }
    private static DiscoveryProviderResult unavailable(DiscoveryProvider provider) {
        return new DiscoveryProviderResult(provider.name(),"",List.of(),List.of(provider.name()+" was unavailable within the search time limit; partial results are shown."));
    }
}
