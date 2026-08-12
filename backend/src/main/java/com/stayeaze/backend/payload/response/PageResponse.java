package com.stayeaze.backend.payload.response;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Generic paginated response wrapper used by all list endpoints.
 * Shape: { data: [...], total: N, page: 1, pageSize: 10, totalPages: N }
 * The DataTable component reads `total` and activates true server-side pagination mode.
 */
public class PageResponse<T> {

    private List<T> data;
    private long total;
    private int page;
    private int pageSize;
    private int totalPages;

    public PageResponse(List<T> data, long total, int page, int pageSize, int totalPages) {
        this.data = data;
        this.total = total;
        this.page = page;
        this.pageSize = pageSize;
        this.totalPages = totalPages;
    }

    /**
     * Build a PageResponse from a Spring Data Page<T>.
     * Page numbers in Spring are 0-based; we expose 1-based to the frontend.
     */
    public static <T> PageResponse<T> ofPage(Page<T> springPage) {
        return new PageResponse<>(
                springPage.getContent(),
                springPage.getTotalElements(),
                springPage.getNumber() + 1,         // 0-based → 1-based
                springPage.getSize(),
                springPage.getTotalPages()
        );
    }

    /**
     * Fallback: slice an in-memory list (used only when the query cannot be easily paged at DB level).
     */
    public static <T> PageResponse<T> of(List<T> fullList, int page, int pageSize) {
        int total = fullList.size();
        int safeSize = Math.max(1, pageSize);
        int safePage = Math.max(1, page);
        int fromIdx = Math.min((safePage - 1) * safeSize, total);
        int toIdx = Math.min(fromIdx + safeSize, total);
        int totalPages = (int) Math.ceil((double) total / safeSize);
        return new PageResponse<>(fullList.subList(fromIdx, toIdx), total, safePage, safeSize, Math.max(1, totalPages));
    }

    public List<T> getData() { return data; }
    public void setData(List<T> data) { this.data = data; }

    public long getTotal() { return total; }
    public void setTotal(long total) { this.total = total; }

    public int getPage() { return page; }
    public void setPage(int page) { this.page = page; }

    public int getPageSize() { return pageSize; }
    public void setPageSize(int pageSize) { this.pageSize = pageSize; }

    public int getTotalPages() { return totalPages; }
    public void setTotalPages(int totalPages) { this.totalPages = totalPages; }
}
