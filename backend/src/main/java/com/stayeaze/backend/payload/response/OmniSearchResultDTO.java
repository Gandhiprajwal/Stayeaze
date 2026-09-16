package com.stayeaze.backend.payload.response;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class OmniSearchResultDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    public static class SearchItem implements Serializable {
        private static final long serialVersionUID = 1L;
        private UUID id;
        private String title;
        private String subtitle;
        private String category;
        private String url;

        public SearchItem() {}

        public SearchItem(UUID id, String title, String subtitle, String category, String url) {
            this.id = id;
            this.title = title;
            this.subtitle = subtitle;
            this.category = category;
            this.url = url;
        }

        public UUID getId() { return id; }
        public void setId(UUID id) { this.id = id; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getSubtitle() { return subtitle; }
        public void setSubtitle(String subtitle) { this.subtitle = subtitle; }

        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }

        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }
    }

    private List<SearchItem> properties = new ArrayList<>();
    private List<SearchItem> tenants = new ArrayList<>();
    private List<SearchItem> rooms = new ArrayList<>();
    private List<SearchItem> invoices = new ArrayList<>();
    private List<SearchItem> users = new ArrayList<>();

    public OmniSearchResultDTO() {}

    public List<SearchItem> getProperties() { return properties; }
    public void setProperties(List<SearchItem> properties) { this.properties = properties; }

    public List<SearchItem> getTenants() { return tenants; }
    public void setTenants(List<SearchItem> tenants) { this.tenants = tenants; }

    public List<SearchItem> getRooms() { return rooms; }
    public void setRooms(List<SearchItem> rooms) { this.rooms = rooms; }

    public List<SearchItem> getInvoices() { return invoices; }
    public void setInvoices(List<SearchItem> invoices) { this.invoices = invoices; }

    public List<SearchItem> getUsers() { return users; }
    public void setUsers(List<SearchItem> users) { this.users = users; }
}
