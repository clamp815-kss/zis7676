package studio.hancut.service;

import studio.hancut.model.ProjectData;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ProjectService {
    public void save(ProjectData project, Path path) throws IOException {
        try (ObjectOutputStream out = new ObjectOutputStream(Files.newOutputStream(path))) {
            out.writeObject(project);
        }
    }

    public ProjectData load(Path path) throws IOException {
        try (ObjectInputStream in = new ObjectInputStream(Files.newInputStream(path))) {
            Object value = in.readObject();
            if (!(value instanceof ProjectData project)) throw new IOException("HanCut 프로젝트 파일이 아닙니다.");
            return project;
        } catch (ClassNotFoundException error) {
            throw new IOException("프로젝트 형식을 읽을 수 없습니다.", error);
        }
    }
}
