package studio.hancut.model;

public enum MediaType {
    VIDEO("영상"), IMAGE("이미지"), AUDIO("오디오");

    private final String label;

    MediaType(String label) { this.label = label; }

    public String label() { return label; }
}
