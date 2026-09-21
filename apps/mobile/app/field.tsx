import { useEffect, useState } from "react";
import { Alert, Image, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addFieldObservation, createFieldObservation, describeGpsQuality, mergeFieldEvidence, parseFieldEvidenceImport, parseFieldObservations, serializeFieldEvidence, type FieldObservation, type FieldObservationKind } from "@claimgrid/core";
import { persistFieldPhoto, removeManagedFieldPhoto } from "../lib/field-photo-storage";

const STORAGE_KEY = "claimgrid.field-observations.v1";

const kinds: { value: FieldObservationKind; label: string }[] = [
  { value: "site", label: "Site" }, { value: "monument", label: "Monument" }, { value: "corner-candidate", label: "Corner candidate" },
  { value: "sample", label: "Sample" }, { value: "access", label: "Access" }, { value: "hazard", label: "Hazard" }
];

export default function FieldCapture() {
  const [kind, setKind] = useState<FieldObservationKind>("site");
  const [note, setNote] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [records, setRecords] = useState<FieldObservation[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  useEffect(() => { AsyncStorage.getItem(STORAGE_KEY).then(raw => setRecords(parseFieldObservations(raw))).catch(() => undefined); }, []);

  async function saveRecords(next: FieldObservation[]) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setRecords(next);
    const retainedPhotos = new Set(next.map(item => item.photoUri).filter((uri): uri is string => Boolean(uri)));
    await Promise.allSettled(records.filter(item => item.photoUri && !retainedPhotos.has(item.photoUri)).map(item => removeManagedFieldPhoto(item.photoUri)));
  }

  async function capture() {
    setCapturing(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { Alert.alert("Location permission needed", "ClaimGrid only reads location when you tap Capture GPS observation."); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let record = createFieldObservation({ kind, note, latitude: position.coords.latitude, longitude: position.coords.longitude, horizontalAccuracyMeters: position.coords.accuracy, altitudeMeters: position.coords.altitude, capturedAt: new Date(position.timestamp).toISOString(), photoUri: null });
      if (photoUri) {
        try {
          record = { ...record, photoUri: await persistFieldPhoto(photoUri, record.id) };
        } catch {
          Alert.alert("Photo not saved", "The camera image could not be copied into durable app storage. The GPS observation and note will still be saved without the photo.");
        }
      }
      const next = addFieldObservation(records, record);
      try {
        await saveRecords(next);
      } catch (error) {
        await removeManagedFieldPhoto(record.photoUri).catch(() => undefined);
        throw error;
      }
      setNote(""); setPhotoUri(null);
    } catch (error) { Alert.alert("Unable to capture GPS", error instanceof Error ? error.message : "Try again with a clear view of the sky."); }
    finally { setCapturing(false); }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert("Camera permission needed", "ClaimGrid only opens the camera when you choose Add field photo."); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.75, exif: false });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  function remove(record: FieldObservation) {
    Alert.alert("Delete field observation?", "This removes the on-device record and its managed photo. It cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { void saveRecords(records.filter(item => item.id !== record.id)).catch(() => Alert.alert("Delete failed", "The observation remains saved. Try again before clearing app storage.")); } }]);
  }

  async function exportRecords() {
    try {
      await Share.share({ title: "ClaimGrid field evidence", message: serializeFieldEvidence(records) });
    } catch {
      Alert.alert("Unable to export", "The device share sheet could not be opened. Your observations remain saved on this device.");
    }
  }

  function reviewImport() {
    try {
      const backup = parseFieldEvidenceImport(importText);
      const photoWarning = backup.photoReferenceCount > 0 ? ` ${backup.photoReferenceCount} photo reference${backup.photoReferenceCount === 1 ? "" : "s"} may not display unless those local files still exist on this device.` : "";
      Alert.alert("Restore field evidence?", `This valid backup contains ${backup.observations.length} observation${backup.observations.length === 1 ? "" : "s"}. It will merge with this device's records; matching IDs will use the imported copy.${photoWarning}`, [
        { text: "Cancel", style: "cancel" },
        { text: "Merge backup", onPress: () => { void saveRecords(mergeFieldEvidence(records, backup.observations)).then(() => { setImportText(""); setShowImport(false); Alert.alert("Backup restored", "The validated observations were merged into on-device storage."); }).catch(() => Alert.alert("Restore failed", "Nothing was removed. Keep the backup and try again.")); } }
      ]);
    } catch (error) {
      Alert.alert("Backup not restored", error instanceof Error ? error.message : "The backup could not be validated. Existing records were not changed.");
    }
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.kicker}>FIELD EVIDENCE</Text><Text style={styles.title}>Capture what you actually see.</Text>
    <View style={styles.warning}><Text style={styles.warningTitle}>Not a legal survey or claim corner</Text><Text style={styles.warningText}>Phone GPS can drift. These observations do not mark boundaries, establish discovery, prove land availability, or replace monuments and official records.</Text></View>
    <Text style={styles.label}>Observation type</Text><View style={styles.chips}>{kinds.map(item => <TouchableOpacity accessibilityRole="button" accessibilityState={{selected: kind === item.value}} key={item.value} onPress={() => setKind(item.value)} style={[styles.chip, kind === item.value && styles.chipActive]}><Text style={[styles.chipText, kind === item.value && styles.chipTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
    <Text style={styles.label}>Field note</Text><TextInput style={styles.input} multiline maxLength={2000} value={note} onChangeText={setNote} placeholder="Describe markings, access, terrain, or what you observed…" placeholderTextColor="#788078" />
    {photoUri ? <View style={styles.pendingPhoto}><Image source={{uri:photoUri}} style={styles.photo}/><TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove pending field photo" onPress={()=>setPhotoUri(null)} style={styles.removePhoto}><Text style={styles.removePhotoText}>Remove photo</Text></TouchableOpacity></View> : <TouchableOpacity accessibilityRole="button" onPress={takePhoto} style={styles.photoButton}><Text style={styles.photoButtonText}>＋ Add field photo</Text></TouchableOpacity>}
    <TouchableOpacity disabled={capturing} onPress={capture} style={[styles.capture, capturing && styles.disabled]}><Text style={styles.captureText}>{capturing ? "Acquiring high-accuracy reading…" : "Capture GPS observation"}</Text></TouchableOpacity>
    <View style={styles.sessionRow}><Text style={styles.session}>SAVED ON THIS DEVICE · {records.length} RECORD{records.length === 1 ? "" : "S"}</Text>{records.length > 0 && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Export all field observations" onPress={exportRecords} style={styles.exportButton}><Text style={styles.exportText}>Export backup</Text></TouchableOpacity>}</View>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showImport }} onPress={() => setShowImport(value => !value)} style={styles.importToggle}><Text style={styles.importToggleText}>{showImport ? "Cancel backup restore" : "Restore a backup"}</Text></TouchableOpacity>
    {showImport ? <View style={styles.importPanel}><Text style={styles.importHelp}>Paste a ClaimGrid field evidence JSON backup. It is validated before storage changes. Imported photo links only work while their original device files still exist.</Text><TextInput accessibilityLabel="Field evidence backup JSON" style={styles.importInput} multiline value={importText} onChangeText={setImportText} autoCapitalize="none" autoCorrect={false} placeholder="Paste claimgrid-field-evidence-v1 JSON…" placeholderTextColor="#788078"/><TouchableOpacity accessibilityRole="button" onPress={reviewImport} style={styles.importButton}><Text style={styles.importButtonText}>Validate and review</Text></TouchableOpacity></View> : null}
    {records.length === 0 ? <Text style={styles.empty}>Captured observations will appear here. Keep independent backups before leaving the field.</Text> : records.map(record => { const quality = describeGpsQuality(record.horizontalAccuracyMeters); return <View key={record.id} style={styles.card}>{record.photoUri ? <Image source={{uri:record.photoUri}} style={styles.savedPhoto} accessibilityLabel={`Field photo for ${record.kind} observation`}/> : null}<View style={styles.cardTop}><Text style={styles.kind}>{record.kind.replace("-", " ").toUpperCase()}</Text><Text style={[styles.quality, styles[quality]]}>{quality.toUpperCase()} GPS</Text></View><Text style={styles.coords}>{record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}</Text><Text style={styles.meta}>± {record.horizontalAccuracyMeters?.toFixed(1) ?? "unknown"} m · {new Date(record.capturedAt).toLocaleString()}</Text>{record.note ? <Text style={styles.note}>{record.note}</Text> : null}<View style={styles.cardFoot}><Text style={styles.evidence}>DEVICE READING ONLY</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${record.kind} observation`} onPress={() => remove(record)}><Text style={styles.delete}>Delete</Text></TouchableOpacity></View></View>; })}
  </ScrollView>;
}

const styles = StyleSheet.create({page:{backgroundColor:"#f5f1e7"},content:{padding:22,paddingTop:36,paddingBottom:70},kicker:{fontSize:11,letterSpacing:2,color:"#9b583d",fontWeight:"800"},title:{fontFamily:"Georgia",fontSize:42,lineHeight:45,color:"#172018",marginTop:12,marginBottom:20},warning:{backgroundColor:"#172018",padding:18,borderRadius:10},warningTitle:{color:"#f5f1e7",fontWeight:"800",marginBottom:7},warningText:{color:"#c3cbc1",fontSize:13,lineHeight:19},label:{fontWeight:"800",color:"#283128",marginTop:25,marginBottom:10},chips:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{borderWidth:1,borderColor:"#b9b7ae",paddingVertical:9,paddingHorizontal:12,borderRadius:20},chipActive:{backgroundColor:"#9b583d",borderColor:"#9b583d"},chipText:{fontSize:12,color:"#3e483f",fontWeight:"700"},chipTextActive:{color:"white"},input:{minHeight:110,textAlignVertical:"top",borderWidth:1,borderColor:"#bbb8ae",borderRadius:9,backgroundColor:"white",padding:14,color:"#172018",fontSize:15},photoButton:{borderWidth:1,borderColor:"#9b583d",padding:13,alignItems:"center",borderRadius:8,marginTop:12},photoButtonText:{color:"#8c482f",fontWeight:"800"},pendingPhoto:{marginTop:12,borderRadius:9,overflow:"hidden",backgroundColor:"#172018"},photo:{width:"100%",height:190},removePhoto:{padding:11,alignItems:"center"},removePhotoText:{color:"white",fontWeight:"700"},capture:{backgroundColor:"#9b583d",padding:17,alignItems:"center",borderRadius:8,marginTop:14},disabled:{opacity:.55},captureText:{color:"white",fontWeight:"800"},sessionRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:34,marginBottom:12},session:{fontSize:10,letterSpacing:1.2,color:"#9b583d",fontWeight:"800",flexShrink:1},exportButton:{borderWidth:1,borderColor:"#9b583d",borderRadius:16,paddingVertical:7,paddingHorizontal:10,marginLeft:8},exportText:{color:"#9b583d",fontSize:11,fontWeight:"800"},importToggle:{alignSelf:"flex-start",paddingVertical:8},importToggleText:{color:"#7f4935",fontSize:12,fontWeight:"800",textDecorationLine:"underline"},importPanel:{backgroundColor:"#ebe5d8",borderRadius:9,padding:14,marginBottom:14},importHelp:{fontSize:12,lineHeight:18,color:"#4c554c",marginBottom:10},importInput:{minHeight:120,textAlignVertical:"top",borderWidth:1,borderColor:"#bbb8ae",borderRadius:7,backgroundColor:"white",padding:11,color:"#172018",fontSize:12,fontFamily:"monospace"},importButton:{backgroundColor:"#172018",padding:13,alignItems:"center",borderRadius:7,marginTop:10},importButtonText:{color:"white",fontWeight:"800"},empty:{color:"#687168",fontSize:13,lineHeight:20},card:{backgroundColor:"white",borderWidth:1,borderColor:"#dad5ca",padding:17,borderRadius:10,marginBottom:12,overflow:"hidden"},savedPhoto:{height:170,margin:-17,marginBottom:17},cardTop:{flexDirection:"row",justifyContent:"space-between"},kind:{fontSize:11,letterSpacing:1.2,fontWeight:"800",color:"#8f4d35"},quality:{fontSize:10,fontWeight:"800"},strong:{color:"#397144"},moderate:{color:"#8a671f"},weak:{color:"#a33d2d"},unknown:{color:"#687168"},coords:{fontFamily:"monospace",fontSize:18,fontWeight:"700",color:"#172018",marginTop:11},meta:{fontSize:12,color:"#687168",marginTop:5},note:{fontSize:14,lineHeight:20,color:"#39433a",marginTop:14},cardFoot:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:14},evidence:{fontSize:9,letterSpacing:1.3,color:"#8a918a",fontWeight:"800"},delete:{color:"#9b3f2d",fontSize:12,fontWeight:"800"}});
